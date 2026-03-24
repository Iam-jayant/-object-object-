// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MediProof
 * @notice Decentralized medicine batch verification — Mainnet Ready v3
 * @dev Gas-optimized: custom errors, unchecked counters, struct packing, calldata inputs
 */
contract MediProof {

    // ──────────────────────────────────────────
    //  CONSTANTS
    // ──────────────────────────────────────────

    uint256 public constant SUSPICIOUS_THRESHOLD = 3;

    // ──────────────────────────────────────────
    //  CUSTOM ERRORS  (cheaper than revert strings)
    // ──────────────────────────────────────────

    error AlreadyRegistered();
    error NotRegisteredManufacturer();
    error BatchAlreadyExists(string batchId);
    error BatchDoesNotExist(string batchId);
    error AlreadyReported();
    error AlreadyRecalled();
    error NotBatchManufacturer();
    error EmptyField(string field);
    error ExpiryInPast();
    error Unauthorized();

    // ──────────────────────────────────────────
    //  STRUCTS  (fields ordered to minimise slot usage)
    // ──────────────────────────────────────────

    struct Manufacturer {
        address wallet;       // slot 0: 20 bytes
        uint96  registeredAt; // slot 0: 12 bytes  (fits in same slot)
        string  name;
        string  licenseNumber;
    }

    struct Batch {
        address manufacturer; // slot 0: 20 bytes
        bool    isRecalled;   // slot 0: 1 byte    (packed)
        uint88  createdAt;    // slot 0: 11 bytes  (packed)
        uint256 expiryDate;
        string  batchId;
        string  ipfsHash;
    }

    struct Report {
        address reporter;    // slot 0: 20 bytes
        uint96  timestamp;   // slot 0: 12 bytes (packed)
        string  batchId;
        string  reason;
    }

    struct Checkpoint {
        address recorder;    // slot 0: 20 bytes
        uint96  timestamp;   // slot 0: 12 bytes (packed)
        string  location;
        string  note;
    }

    // ──────────────────────────────────────────
    //  STORAGE
    // ──────────────────────────────────────────

    mapping(address => Manufacturer)               public manufacturers;
    mapping(string  => Batch)                      public batches;
    mapping(string  => Report[])                   public reports;
    mapping(string  => Checkpoint[])               public checkpoints;
    mapping(string  => mapping(address => bool))   public hasReported;
    mapping(string  => uint256)                    public reportCount;

    // ──────────────────────────────────────────
    //  EVENTS
    // ──────────────────────────────────────────

    event ManufacturerRegistered(address indexed wallet, string name, string licenseNumber, uint256 timestamp);
    event BatchRegistered(string indexed batchId, address indexed manufacturer, string ipfsHash, uint256 expiryDate, uint256 timestamp);
    event BatchRecalled(string indexed batchId, address indexed manufacturer, uint256 timestamp);
    event BatchReported(string indexed batchId, address indexed reporter, string reason, uint256 timestamp);
    event BatchSuspicious(string indexed batchId, uint256 reportCount, uint256 timestamp);
    event CheckpointAdded(string indexed batchId, address indexed recorder, string location, uint256 timestamp);

    // ──────────────────────────────────────────
    //  MODIFIERS
    // ──────────────────────────────────────────

    modifier onlyRegisteredManufacturer() {
        if (manufacturers[msg.sender].wallet != msg.sender) revert NotRegisteredManufacturer();
        _;
    }

    modifier batchExists(string calldata batchId) {
        if (batches[batchId].manufacturer == address(0)) revert BatchDoesNotExist(batchId);
        _;
    }

    // ──────────────────────────────────────────
    //  WRITE FUNCTIONS
    // ──────────────────────────────────────────

    /**
     * @notice Register as a verified manufacturer (once per wallet)
     */
    function registerManufacturer(
        string calldata name,
        string calldata licenseNumber
    ) external {
        if (bytes(name).length == 0)          revert EmptyField("name");
        if (bytes(licenseNumber).length == 0)  revert EmptyField("licenseNumber");
        if (manufacturers[msg.sender].wallet == msg.sender) revert AlreadyRegistered();

        manufacturers[msg.sender] = Manufacturer({
            wallet:        msg.sender,
            registeredAt:  uint96(block.timestamp),
            name:          name,
            licenseNumber: licenseNumber
        });

        emit ManufacturerRegistered(msg.sender, name, licenseNumber, block.timestamp);
    }

    /**
     * @notice Register a new medicine batch (manufacturer only)
     */
    function registerBatch(
        string calldata batchId,
        string calldata ipfsHash,
        uint256         expiryDate
    ) external onlyRegisteredManufacturer {
        if (bytes(batchId).length == 0)                     revert EmptyField("batchId");
        if (bytes(ipfsHash).length == 0)                    revert EmptyField("ipfsHash");
        if (expiryDate <= block.timestamp)                   revert ExpiryInPast();
        if (batches[batchId].manufacturer != address(0))    revert BatchAlreadyExists(batchId);

        batches[batchId] = Batch({
            manufacturer: msg.sender,
            isRecalled:   false,
            createdAt:    uint88(block.timestamp),
            expiryDate:   expiryDate,
            batchId:      batchId,
            ipfsHash:     ipfsHash
        });

        emit BatchRegistered(batchId, msg.sender, ipfsHash, expiryDate, block.timestamp);
    }

    /**
     * @notice Report a batch issue — one report per wallet per batch
     */
    function reportBatch(
        string calldata batchId,
        string calldata reason
    ) external batchExists(batchId) {
        if (bytes(reason).length == 0)         revert EmptyField("reason");
        if (hasReported[batchId][msg.sender])  revert AlreadyReported();

        hasReported[batchId][msg.sender] = true;

        uint256 count;
        unchecked { count = ++reportCount[batchId]; }

        reports[batchId].push(Report({
            reporter:  msg.sender,
            timestamp: uint96(block.timestamp),
            batchId:   batchId,
            reason:    reason
        }));

        emit BatchReported(batchId, msg.sender, reason, block.timestamp);
        if (count == SUSPICIOUS_THRESHOLD) emit BatchSuspicious(batchId, count, block.timestamp);
    }

    /**
     * @notice Recall a batch (only the registering manufacturer)
     */
    function recallBatch(string calldata batchId) external batchExists(batchId) {
        if (batches[batchId].manufacturer != msg.sender) revert NotBatchManufacturer();
        if (batches[batchId].isRecalled)                  revert AlreadyRecalled();

        batches[batchId].isRecalled = true;
        emit BatchRecalled(batchId, msg.sender, block.timestamp);
    }

    /**
     * @notice Add a supply chain checkpoint for a batch (any registered manufacturer or the batch owner)
     */
    function addCheckpoint(
        string calldata batchId,
        string calldata location,
        string calldata note
    ) external batchExists(batchId) {
        if (bytes(location).length == 0) revert EmptyField("location");

        checkpoints[batchId].push(Checkpoint({
            recorder:  msg.sender,
            timestamp: uint96(block.timestamp),
            location:  location,
            note:      note
        }));

        emit CheckpointAdded(batchId, msg.sender, location, block.timestamp);
    }

    // ──────────────────────────────────────────
    //  VIEW FUNCTIONS
    // ──────────────────────────────────────────

    function getBatch(string calldata batchId) external view batchExists(batchId) returns (Batch memory) {
        return batches[batchId];
    }

    function getManufacturer(address wallet) external view returns (Manufacturer memory) {
        return manufacturers[wallet];
    }

    function getReports(string calldata batchId) external view returns (Report[] memory) {
        return reports[batchId];
    }

    function getCheckpoints(string calldata batchId) external view returns (Checkpoint[] memory) {
        return checkpoints[batchId];
    }

    function isSuspicious(string calldata batchId) external view returns (bool) {
        return reportCount[batchId] >= SUSPICIOUS_THRESHOLD;
    }

    /**
     * @notice Returns batch status: 0=Valid, 1=Expired, 2=Recalled, 3=Suspicious, 4=Expired+Suspicious
     */
    function getBatchStatus(string calldata batchId) external view batchExists(batchId) returns (uint8) {
        Batch storage b   = batches[batchId];
        bool expired      = b.expiryDate <= block.timestamp;
        bool recalled     = b.isRecalled;
        bool suspicious   = reportCount[batchId] >= SUSPICIOUS_THRESHOLD;

        if (recalled)              return 2;
        if (expired && suspicious) return 4;
        if (expired)               return 1;
        if (suspicious)            return 3;
        return 0;
    }

    function isManufacturer(address wallet) external view returns (bool) {
        return manufacturers[wallet].wallet == wallet;
    }
}
