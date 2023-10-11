import { body, validationResult } from 'express-validator';

const resigterValidation = [
 body('name')
  .notEmpty().withMessage('Nama tidak boleh kosong')
  .isLength({ min: 2, max: 256 }).withMessage('Nama harus memiliki panjang antara 2 hingga 256 karakter'),

 body('username')
  .notEmpty().withMessage('Username tidak boleh kosong'),

 body('student_id_number')
  .isLength({ min: 12, max: 12 }).withMessage('Nomor Induk Siswa harus memiliki panjang 12 karakter'),

 body('reminder')
  .notEmpty().withMessage('Reminder tidak boleh kosong'),

 body('password')
  .isLength({ min: 6 }).withMessage('Password harus memiliki minimal 6 karakter'),

 (request, response, next) => {
  const errors = validationResult(request);
  if (!errors.isEmpty()) {
   return response.status(422).json({ errors: errors.array() });
  }
  next();
 },
];

const login = [
 body('username')
  .notEmpty().withMessage('Username tidak boleh kosong'),
 body('password')
  .isLength({ min: 6 }).withMessage('Password harus memiliki minimal 6 karakter'),
 (request, response, next) => {
  const errors = validationResult(request);
  if (!errors.isEmpty()) {
   return response.status(422).json({ errors: errors.array() });
  }
  next();
 },
];

export { resigterValidation, login };
