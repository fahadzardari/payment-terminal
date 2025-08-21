import prisma from '../lib/prisma.js';
import { sendMail } from '../services/leadMail.js';
import logger from '../utils/logger.js';

// Create a contact request
const createContactRequest = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      message,
      brandId,
      country,
      budget,
      services,
      timeline
    } = req.body;

    logger.info(`New contact request received from ${email} for brand ID ${brandId}`);
    
    // Validate required fields
    if (!name || !email || !phone || !message || !brandId) {
      logger.warn(`Incomplete contact request data: ${JSON.stringify(req.body)}`);
      return res.status(400).json({
        success: false,
        message: 'name, email, phone, message, and brandId are required'
      });
    }
    
    // Verify brand exists and get its email
    const brand = await prisma.brand.findUnique({
      where: { id: parseInt(brandId) }
    });
    
    if (!brand) {
      logger.warn(`Contact request attempted for non-existent brand ID: ${brandId}`);
      return res.status(404).json({
        success: false,
        message: 'Brand not found'
      });
    }
    
    if (!brand.email) {
      logger.warn(`Brand ${brand.name} (ID: ${brand.id}) doesn't have an email configured for notifications`);
    }
    
    // Create contact request
    const contactRequest = await prisma.contactRequest.create({
      data: {
        name,
        email,
        phone,
        message,
        brandId: parseInt(brandId),
        country,
        budget,
        services,
        timeline
      }
    });
    
    // Send email notification if brand has email configured
    if (brand.email) {
      try {
        sendMail({
          name,
          email,
          phone,
          message,
          brandId,
          brandName: brand.name,
          sendTo: brand.email
        });
        logger.info(`Notification email sent to ${brand.email} for contact request ID ${contactRequest.id}`);
      } catch (emailError) {
        logger.error(`Failed to send notification email: ${emailError.message}`);
        // Continue execution - don't fail the request if email fails
      }
    }
    
    logger.info(`Contact request created successfully: ID ${contactRequest.id}`);
    res.status(201).json({
      success: true,
      data: contactRequest
    });
  } catch (error) {
    logger.error(`Error creating contact request: ${error.message} | Stack: ${error.stack}`);
    res.status(500).json({
      success: false,
      message: 'Failed to create contact request',
      error: error.message
    });
  }
};

// Get all contact requests (with pagination and filters)
const getContactRequests = async (req, res) => {
  try {
    const { brandId, status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * parseInt(limit);

    logger.info(`Fetching contact requests with filters: ${JSON.stringify({ brandId, status, page, limit })}`);
    
    // Build filter object
    const where = {};
    if (brandId) where.brandId = parseInt(brandId);
    if (status) where.status = status;

    // Get contact requests
    const contactRequests = await prisma.contactRequest.findMany({
      where,
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            logoUrl: true
          }
        }
      },
      skip,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' }
    });

    // Get total count for pagination
    const totalCount = await prisma.contactRequest.count({ where });
    
    logger.info(`Retrieved ${contactRequests.length} contact requests out of ${totalCount} total`);
    
    res.status(200).json({
      success: true,
      data: contactRequests,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error(`Error fetching contact requests: ${error.message} | Stack: ${error.stack}`);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contact requests',
      error: error.message
    });
  }
};

// Get contact request by ID
const getContactRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    
    logger.info(`Fetching contact request with ID: ${id}`);

    const contactRequest = await prisma.contactRequest.findUnique({
      where: { id: parseInt(id) },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            logoUrl: true
          }
        }
      }
    });

    if (!contactRequest) {
      logger.warn(`Contact request not found with ID: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Contact request not found'
      });
    }

    logger.info(`Retrieved contact request ID: ${id}`);
    res.status(200).json({
      success: true,
      data: contactRequest
    });
  } catch (error) {
    logger.error(`Error fetching contact request: ${error.message} | Stack: ${error.stack}`);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contact request',
      error: error.message
    });
  }
};

// Update contact request status
const updateContactRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    logger.info(`Updating contact request ID: ${id} to status: ${status}`);

    // Validate status
    const validStatuses = ['new', 'contacted', 'closed'];
    if (!validStatuses.includes(status)) {
      logger.warn(`Invalid status provided for contact request ID ${id}: ${status}`);
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }

    const contactRequest = await prisma.contactRequest.update({
      where: { id: parseInt(id) },
      data: { status }
    });

    logger.info(`Successfully updated contact request ID: ${id} to status: ${status}`);
    res.status(200).json({
      success: true,
      data: contactRequest
    });
  } catch (error) {
    logger.error(`Error updating contact request: ${error.message} | Stack: ${error.stack}`);
    res.status(500).json({
      success: false,
      message: 'Failed to update contact request',
      error: error.message
    });
  }
};

export default {
  createContactRequest,
  getContactRequests,
  getContactRequestById,
  updateContactRequestStatus
};