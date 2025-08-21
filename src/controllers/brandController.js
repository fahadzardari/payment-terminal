import prisma from '../lib/prisma.js';
import logger from '../utils/logger.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get the directory name properly in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '../public/brand-logos');

// Make sure the upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Create a safe filename: brand-name-timestamp.ext
    const brandName = req.body.name ? req.body.name.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'brand';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${brandName}-${timestamp}${ext}`);
  }
});

// File filter - only allow certain image types
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.png', '.jpg', '.jpeg', '.svg', '.gif'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PNG, JPG, JPEG, SVG and GIF are allowed.'), false);
  }
};

export const uploadLogo = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB max file size
});

// Create a brand
const createBrand = async (req, res) => {
  try {
    const { name, logoUrl, description, email } = req.body;

    logger.info(`Attempting to create brand: ${name}`);

    // Validate required fields
    if (!name) {
      logger.warn('Brand creation attempted without a name');
      return res.status(400).json({
        success: false,
        message: 'Brand name is required'
      });
    }

    // Create brand
    const brand = await prisma.brand.create({
      data: {
        name,
        logoUrl,
        description,
        email
      }
    });

    logger.info(`Brand created successfully: ${brand.name} (ID: ${brand.id})`);
    res.status(201).json({
      success: true,
      data: brand
    });
  } catch (error) {
    logger.error(`Error creating brand: ${error.message} | Stack: ${error.stack}`);
    res.status(500).json({
      success: false,
      message: 'Failed to create brand',
      error: error.message
    });
  }
};


// Get all brands
const getBrands = async (req, res) => {
  try {
    logger.info('Fetching all brands');
    const brands = await prisma.brand.findMany();

    logger.info(`Retrieved ${brands.length} brands`);
    res.status(200).json({
      success: true,
      data: brands
    });
  } catch (error) {
    logger.error(`Error fetching brands: ${error.message} | Stack: ${error.stack}`);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch brands',
      error: error.message
    });
  }
};

// Get brand by ID
const getBrandById = async (req, res) => {
  try {
    const { id } = req.params;

    logger.info(`Fetching brand with ID: ${id}`);
    const brand = await prisma.brand.findUnique({
      where: { id: parseInt(id) }
    });

    if (!brand) {
      logger.warn(`Brand not found with ID: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Brand not found'
      });
    }

    logger.info(`Retrieved brand: ${brand.name} (ID: ${id})`);
    res.status(200).json({
      success: true,
      data: brand
    });
  } catch (error) {
    logger.error(`Error fetching brand: ${error.message} | Stack: ${error.stack}`);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch brand',
      error: error.message
    });
  }
};


// update brand by ID
const updateBrandById = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, logoUrl, description, email } = req.body;

    logger.info(`Updating brand with ID: ${id}`);

    // Validate required fields
    if (!name) {
      logger.warn('Brand update attempted without a name');
      return res.status(400).json({
        success: false,
        message: 'Brand name is required'
      });
    }

    const brand = await prisma.brand.update({
      where: { id: parseInt(id) },
      data: { name, logoUrl, description, email }
    });

    logger.info(`Brand updated successfully: ${brand.name} (ID: ${id})`);
    res.status(200).json({
      success: true,
      data: brand
    });
  } catch (error) {
    logger.error(`Error updating brand: ${error.message} | Stack: ${error.stack}`);
    res.status(500).json({
      success: false,
      message: 'Failed to update brand',
      error: error.message
    });
  }
};

// New controller method for logo upload
const uploadBrandLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file was uploaded.'
      });
    }

    // Create the logo URL path to be stored in the database
    const logoUrl = `/brand-logos/${req.file.filename}`;

    logger.info(`Uploaded brand logo: ${logoUrl}`);

    res.status(200).json({
      success: true,
      data: {
        logoUrl,
        filename: req.file.filename,
        originalname: req.file.originalname
      }
    });
  } catch (error) {
    logger.error(`Error uploading logo: ${error.message} | Stack: ${error.stack}`);
    res.status(500).json({
      success: false,
      message: 'Failed to upload logo',
      error: error.message
    });
  }
};

export default {
  getBrands,
  getBrandById,
  createBrand,
  updateBrandById,
  uploadBrandLogo
};