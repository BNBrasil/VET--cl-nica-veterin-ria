import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { Request, Response, NextFunction } from 'express';

// Configuration constants
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB

// In-memory storage so we can process images with sharp before saving to disk
const storage = multer.memoryStorage();

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.includes(ext)) {
    return cb(new Error('Formato de arquivo inválido. Apenas imagens (JPG, PNG) e PDFs são permitidos.'));
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  limits: {
    fileSize: Math.max(MAX_IMAGE_SIZE, MAX_PDF_SIZE), // max allowed bound
  },
  fileFilter,
});

/**
 * Middleware to process and save an uploaded animal photo as a compressed 150x150 thumbnail.
 */
export const processAnimalPhoto = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!req.file) {
    return next();
  }

  if (!req.file.mimetype.startsWith('image/')) {
    res.status(400).json({ error: 'O arquivo enviado deve ser uma imagem válida.' });
    return;
  }

  try {
    const uploadsDir = path.join(process.cwd(), 'uploads', 'animais');
    
    // Ensure recursive directories exist
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const filename = `animal-${uniqueSuffix}.jpg`;
    const outputPath = path.join(uploadsDir, filename);

    // Sharp Magic: Resize, crop (cover) to 150x150, convert to optimized progressive JPEG
    await sharp(req.file.buffer)
      .resize(150, 150, { fit: 'cover' })
      .toFormat('jpeg', { quality: 80, progressive: true })
      .toFile(outputPath);

    // Inject physical reference url into the request body or file object so controller can save it
    req.file.filename = filename;
    req.file.path = `/uploads/animais/${filename}`;

    next();
  } catch (error) {
    console.error('[SHARP PROCESSING ERROR]:', error);
    res.status(500).json({ error: 'Erro técnico ao processar e otimizar imagem.' });
  }
};

/**
 * Middleware to save a requested exam PDF file directly onto the disk.
 */
export const saveExamPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!req.file) {
    return next();
  }

  if (req.file.mimetype !== 'application/pdf') {
    res.status(400).json({ error: 'Apenas arquivos do formato PDF são suportados para exames.' });
    return;
  }

  try {
    const uploadsDir = path.join(process.cwd(), 'uploads', 'exames');
    
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const filename = `exame-${uniqueSuffix}.pdf`;
    const outputPath = path.join(uploadsDir, filename);

    // Write buffered memory content straight into output file path
    fs.writeFileSync(outputPath, req.file.buffer);

    req.file.filename = filename;
    req.file.path = `/uploads/exames/${filename}`;

    next();
  } catch (error) {
    console.error('[EXAM PDF WRITE ERROR]:', error);
    res.status(500).json({ error: 'Erro ao persistir PDF do exame solicitado.' });
  }
};
