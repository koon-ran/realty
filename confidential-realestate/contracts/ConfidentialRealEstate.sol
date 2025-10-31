// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title ConfidentialRealEstate
 * @dev Real estate tokenization with encrypted share holdings using Zama FHEVM
 * Key Feature: Share ownership is encrypted - only the shareholder and property owner can see balances
 */
contract ConfidentialRealEstate is SepoliaConfig {
    // Custom errors
    error PropertyDoesNotExist();
    error InvalidAmount();
    error InsufficientShares();
    error InsufficientFunds();
    error RentAlreadyPaidForPeriod();
    error NoRentToClaim();
    error TransferFailed();
    error NotAuthorized();
    error UnauthorizedDecryption();
    error PropertyNotActive();
    error PropertyAlreadyPaused();
    error PropertyAlreadyActive();

    struct Property {
        uint256 id;
        string name;
        address payable owner;
        uint256 price; // Public - total property price
        uint256 totalShares; // Public - total shares available
        uint256 availableShares; // Public - shares not yet sold
        uint256 rent; // Public - periodic rent amount
        uint256 rentPool; // Public - accumulated rent to distribute
        uint256 lastRentPayment;
        uint256 rentPeriod; // in days
        bool isListed;
        uint256 totalRentCollected;
        string images;
        string description;
        string propertyAddress;
        uint256 currentRentPeriodStart;
        uint256 currentRentPeriodEnd;
    }

    struct Shareholder {
        euint64 sharesOwned; // ENCRYPTED - only shareholder + owner can see
        uint256 rentClaimed; // Public for rent calculations
        uint256 lastClaimTimestamp;
    }

    // Constants
    uint256 public constant SECONDS_PER_DAY = 86400;
    uint256 public constant PLATFORM_FEE = 50; // 0.5%
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant PRECISION = 1e18;

    uint256 public propertyIdCounter = 1;
    address public contractOwner;

    mapping(uint256 => Property) public properties;
    mapping(uint256 => mapping(address => Shareholder)) public shareholders;

    // Events
    event PropertyListed(
        uint256 indexed propertyId,
        address indexed owner,
        string name,
        uint256 price,
        uint256 totalShares
    );
    event SharesPurchased(
        uint256 indexed propertyId,
        address indexed buyer,
        uint64 shares,
        uint256 cost
    );
    event RentPaid(
        uint256 indexed propertyId,
        address indexed payer,
        uint256 amount,
        uint256 timestamp
    );
    event RentClaimed(
        uint256 indexed propertyId,
        address indexed shareholder,
        uint256 amount
    );
    event PropertyUpdated(
        uint256 indexed propertyId,
        string name,
        string description,
        string images
    );
    event RentAmountUpdated(
        uint256 indexed propertyId,
        uint256 oldRent,
        uint256 newRent
    );
    event PropertyPaused(
        uint256 indexed propertyId
    );
    event PropertyUnpaused(
        uint256 indexed propertyId
    );

    constructor() {
        contractOwner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != contractOwner) revert NotAuthorized();
        _;
    }

    modifier onlyPropertyOwner(uint256 _propertyId) {
        if (msg.sender != properties[_propertyId].owner) revert NotAuthorized();
        _;
    }

    modifier propertyExists(uint256 _propertyId) {
        if (
            !properties[_propertyId].isListed ||
            _propertyId >= propertyIdCounter
        ) revert PropertyDoesNotExist();
        _;
    }

    /**
     * @dev List a new property for tokenization
     * All parameters are public except share ownership which becomes encrypted on purchase
     */
    function listProperty(
        address payable _owner,
        string memory _name,
        uint256 _price,
        uint256 _totalShares,
        uint256 _rent,
        uint256 _rentPeriod,
        string memory _images,
        string memory _description,
        string memory _propertyAddress
    ) external {
        if (_totalShares == 0 || _price == 0 || _rent == 0 || _rentPeriod == 0)
            revert InvalidAmount();

        uint256 propertyId = propertyIdCounter++;

        Property storage property = properties[propertyId];
        property.id = propertyId;
        property.name = _name;
        property.owner = _owner;
        property.price = _price;
        property.totalShares = _totalShares;
        property.availableShares = _totalShares;
        property.rent = _rent;
        property.rentPeriod = _rentPeriod;
        property.isListed = true;
        property.images = _images;
        property.description = _description;
        property.propertyAddress = _propertyAddress;
        property.currentRentPeriodStart = 0;
        property.currentRentPeriodEnd = 0;

        emit PropertyListed(propertyId, _owner, _name, _price, _totalShares);
    }

    /**
     * @dev Purchase shares - transaction amount is public, but resulting balance is ENCRYPTED
     * This matches real-world: people see transactions happen, but don't know total holdings
     */
    function purchaseShares(
        uint256 _propertyId,
        uint64 numShares
    ) external payable propertyExists(_propertyId) {
        Property storage property = properties[_propertyId];
        
        // Check if property is listed (not paused)
        if (!property.isListed) revert PropertyNotActive();
        
        // Validate shares are available
        if (numShares > property.availableShares) revert InsufficientShares();
        if (numShares == 0) revert InvalidAmount();

        // Calculate cost (share price * shares)
        uint256 sharePrice = (property.price * PRECISION) /
            property.totalShares;
        
        uint256 totalCost = (sharePrice * numShares) / PRECISION;

        if (msg.value < totalCost) revert InvalidAmount();

        uint256 platformFee = (totalCost * PLATFORM_FEE) / BASIS_POINTS;
        uint256 sellerAmount = totalCost - platformFee;

        // Update available shares (public)
        property.availableShares -= numShares;

        // Update shareholder's ENCRYPTED balance
        // Key feature: While the purchase is visible, the TOTAL balance remains encrypted
        Shareholder storage shareholder = shareholders[_propertyId][
            msg.sender
        ];
        
        euint64 sharesToAdd = FHE.asEuint64(numShares);
        
        if (FHE.isInitialized(shareholder.sharesOwned)) {
            // Add to existing encrypted balance
            shareholder.sharesOwned = FHE.add(shareholder.sharesOwned, sharesToAdd);
        } else {
            // First purchase - initialize encrypted balance
            shareholder.sharesOwned = sharesToAdd;
        }

        // Set up ACL - only shareholder and property owner can decrypt
        FHE.allow(shareholder.sharesOwned, msg.sender);
        FHE.allow(shareholder.sharesOwned, property.owner);
        FHE.allowThis(shareholder.sharesOwned);

        // Transfer payment
        (bool success, ) = property.owner.call{value: sellerAmount}("");
        if (!success) revert TransferFailed();

        // Refund excess payment
        if (msg.value > totalCost) {
            (success, ) = msg.sender.call{value: msg.value - totalCost}("");
            if (!success) revert TransferFailed();
        }

        emit SharesPurchased(_propertyId, msg.sender, numShares, totalCost);
    }

    /**
     * @dev Pay rent for a property
     * Rent amount and pool are public - only share ownership is encrypted
     */
    function payRent(uint256 _propertyId, address _payer)
        external
        payable
        propertyExists(_propertyId)
    {
        Property storage property = properties[_propertyId];

        if (msg.value < property.rent) revert InvalidAmount();

        // Check if rent already paid for current period
        uint256 periodEnd = property.currentRentPeriodEnd;
        if (block.timestamp < periodEnd) revert RentAlreadyPaidForPeriod();

        // Add rent to pool (use actual amount sent, not just minimum rent)
        property.rentPool += msg.value;
        property.totalRentCollected += msg.value;
        property.lastRentPayment = block.timestamp;

        // Set new rent period
        property.currentRentPeriodStart = block.timestamp;
        property.currentRentPeriodEnd =
            block.timestamp +
            (property.rentPeriod * SECONDS_PER_DAY);

        emit RentPaid(_propertyId, _payer, msg.value, block.timestamp);
    }

    /**
     * @dev Claim rent based on shares
     * MVP: Pass shares amount as parameter (caller proves ownership via separate mechanism)
     * Production: Would use Gateway/Oracle for encrypted share verification
     */
    function claimRent(uint256 _propertyId, address _shareholder, uint64 shares)
        external
        propertyExists(_propertyId)
    {
        if (msg.sender != _shareholder && msg.sender != contractOwner)
            revert NotAuthorized();

        Property storage property = properties[_propertyId];
        Shareholder storage shareholder = shareholders[_propertyId][
            _shareholder
        ];

        if (!FHE.isInitialized(shareholder.sharesOwned)) revert NoRentToClaim();
        
        if (shares == 0 || property.rentPool == 0) revert NoRentToClaim();

        // Calculate rent based on ownership percentage
        uint256 shareholderPercentage = (shares * PRECISION) /
            property.totalShares;
        uint256 rentAmount = (property.rentPool * shareholderPercentage) /
            PRECISION;

        if (rentAmount == 0) revert NoRentToClaim();

        // Update state
        shareholder.rentClaimed += rentAmount;
        shareholder.lastClaimTimestamp = block.timestamp;
        property.rentPool -= rentAmount;

        // Transfer rent
        (bool success, ) = payable(_shareholder).call{value: rentAmount}("");
        if (!success) revert TransferFailed();

        emit RentClaimed(_propertyId, _shareholder, rentAmount);
    }

    /**
     * @dev Get shareholder info with encrypted shares
     * Returns encrypted balance - caller must be authorized to decrypt
     */
    function getShareholderInfo(uint256 _propertyId, address _shareholder)
        external
        view
        propertyExists(_propertyId)
        returns (
            euint64 encryptedShares,
            uint256 rentClaimed,
            uint256 unclaimedRent
        )
    {
        Property storage property = properties[_propertyId];
        Shareholder storage shareholder = shareholders[_propertyId][
            _shareholder
        ];

        encryptedShares = shareholder.sharesOwned;
        rentClaimed = shareholder.rentClaimed;

        // Calculate unclaimed rent (if they have shares)
        if (FHE.isInitialized(shareholder.sharesOwned) && property.rentPool > 0) {
            // For view function, we can't decrypt
            // Frontend will need to decrypt shares and calculate
            unclaimedRent = 0; // Placeholder - calculate on frontend after decryption
        } else {
            unclaimedRent = 0;
        }

        return (encryptedShares, rentClaimed, unclaimedRent);
    }

    /**
     * @dev Update property details (owner only)
     */
    function updateProperty(
        uint256 _propertyId,
        string memory _name,
        string memory _description,
        string memory _images
    ) external propertyExists(_propertyId) onlyPropertyOwner(_propertyId) {
        Property storage property = properties[_propertyId];
        
        property.name = _name;
        property.description = _description;
        property.images = _images;

        emit PropertyUpdated(_propertyId, _name, _description, _images);
    }

    /**
     * @dev Update rent amount (owner only)
     */
    function updateRentAmount(
        uint256 _propertyId,
        uint256 _newRent
    ) external propertyExists(_propertyId) onlyPropertyOwner(_propertyId) {
        if (_newRent == 0) revert InvalidAmount();
        
        Property storage property = properties[_propertyId];
        uint256 oldRent = property.rent;
        property.rent = _newRent;

        emit RentAmountUpdated(_propertyId, oldRent, _newRent);
    }

    /**
     * @dev Pause property (owner only) - prevents new share purchases
     */
    function pauseProperty(uint256 _propertyId) 
        external 
        propertyExists(_propertyId) 
        onlyPropertyOwner(_propertyId) 
    {
        Property storage property = properties[_propertyId];
        if (!property.isListed) revert PropertyAlreadyPaused();
        
        property.isListed = false;
        emit PropertyPaused(_propertyId);
    }

    /**
     * @dev Unpause property (owner only) - allows share purchases again
     */
    function unpauseProperty(uint256 _propertyId) 
        external 
        propertyExists(_propertyId) 
        onlyPropertyOwner(_propertyId) 
    {
        Property storage property = properties[_propertyId];
        if (property.isListed) revert PropertyAlreadyActive();
        
        property.isListed = true;
        emit PropertyUnpaused(_propertyId);
    }

    /**
     * @dev Get property details
     * All public except share ownership
     */
    function getProperty(uint256 _propertyId)
        external
        view
        propertyExists(_propertyId)
        returns (
            uint256 id,
            string memory name,
            address owner,
            uint256 price,
            uint256 totalShares,
            uint256 availableShares,
            uint256 rent,
            uint256 rentPool,
            bool isListed,
            string memory images,
            string memory description,
            string memory propertyAddress,
            uint256 rentPeriod,
            uint256 currentRentPeriodStart,
            uint256 currentRentPeriodEnd,
            uint256 totalRentCollected
        )
    {
        Property storage prop = properties[_propertyId];

        return (
            prop.id,
            prop.name,
            prop.owner,
            prop.price,
            prop.totalShares,
            prop.availableShares,
            prop.rent,
            prop.rentPool,
            prop.isListed,
            prop.images,
            prop.description,
            prop.propertyAddress,
            prop.rentPeriod,
            prop.currentRentPeriodStart,
            prop.currentRentPeriodEnd,
            prop.totalRentCollected
        );
    }

    /**
     * @dev Get all properties (public data only)
     */
    function getAllProperties()
        external
        view
        returns (
            uint256[] memory ids,
            string[] memory names,
            uint256[] memory prices,
            uint256[] memory totalShares,
            uint256[] memory availableShares
        )
    {
        uint256 listedCount = 0;
        for (uint256 i = 1; i < propertyIdCounter; i++) {
            if (properties[i].isListed) {
                listedCount++;
            }
        }

        ids = new uint256[](listedCount);
        names = new string[](listedCount);
        prices = new uint256[](listedCount);
        totalShares = new uint256[](listedCount);
        availableShares = new uint256[](listedCount);

        uint256 currentIndex = 0;
        for (uint256 i = 1; i < propertyIdCounter; i++) {
            if (properties[i].isListed) {
                Property storage prop = properties[i];
                ids[currentIndex] = prop.id;
                names[currentIndex] = prop.name;
                prices[currentIndex] = prop.price;
                totalShares[currentIndex] = prop.totalShares;
                availableShares[currentIndex] = prop.availableShares;
                currentIndex++;
            }
        }

        return (ids, names, prices, totalShares, availableShares);
    }

    /**
     * @dev Check if rent is due for a property
     */
    function isRentDue(uint256 _propertyId)
        external
        view
        propertyExists(_propertyId)
        returns (bool)
    {
        Property storage property = properties[_propertyId];
        return block.timestamp >= property.currentRentPeriodEnd;
    }

    // Fallback to receive ETH
    receive() external payable {}
}
