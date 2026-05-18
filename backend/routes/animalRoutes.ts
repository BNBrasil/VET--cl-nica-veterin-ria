import { Router } from 'express';
import { createAnimal, listAnimals, getAnimalById, updateAnimal, deleteAnimal } from '../controllers/animalController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { upload, processAnimalPhoto } from '../middlewares/uploadMiddleware';

const router = Router();

// All routes require basic authentication
router.use(authMiddleware);

router.get('/', listAnimals);
router.get('/:id', getAnimalById);

// Photo upload injected into post and put
router.post('/', upload.single('photo'), processAnimalPhoto, createAnimal);
router.put('/:id', upload.single('photo'), processAnimalPhoto, updateAnimal);

router.delete('/:id', deleteAnimal);

export default router;
