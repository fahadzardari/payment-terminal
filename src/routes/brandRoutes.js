import express from 'express';
import brandController, { uploadLogo } from '../controllers/brandController.js';
import { authenticate } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Get all brands
router.get('/', authenticate, brandController.getBrands);

// Create a brand (protected)
router.post('/', authenticate, brandController.createBrand);

// Upload a logo file (protected but handle differently for multipart)
router.post('/upload-logo', uploadLogo.single('logo'), brandController.uploadBrandLogo);

// Get a single brand (protected)
router.get('/:id', authenticate, brandController.getBrandById);

// Update a brand (protected)
router.put('/:id', authenticate, brandController.updateBrandById);


export default router;