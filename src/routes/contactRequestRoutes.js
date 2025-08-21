import express from 'express';
import contactRequestController from '../controllers/contactRequestController.js';
import {authenticate} from "../middlewares/authMiddleware.js";

const router = express.Router();

// Create a contact request
router.post('/', contactRequestController.createContactRequest);

// Get all contact requests with optional filters
router.get('/',authenticate, contactRequestController.getContactRequests);

// Get a single contact request by ID
router.get('/:id',authenticate, contactRequestController.getContactRequestById);

// Update contact request status
router.patch('/:id/status',authenticate, contactRequestController.updateContactRequestStatus);

export default router;