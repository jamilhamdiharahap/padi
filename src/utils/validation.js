import { body, validationResult } from 'express-validator';

const registerValidation = [
 body('full_name').notEmpty().withMessage('Nama lengkap tidak boleh kosong'),
 body('email').notEmpty().withMessage('Email tidak boleh kosong').isEmail().withMessage('Email tidak valid'),
 body('question').notEmpty().withMessage('Pertanyaan tidak boleh kosong'),
 body('date_of_birth').notEmpty().withMessage('Tanggal lahir tidak boleh kosong'),
 body('position').notEmpty().withMessage('Posisi tidak boleh kosong'),
 body('reminder').notEmpty().withMessage('Pengingat tidak boleh kosong'),
 body('password').isLength({ min: 6 }).withMessage('Password harus memiliki minimal 6 karakter'),
 (request, response, next) => {
   const errors = validationResult(request);
   if (!errors.isEmpty()) {
     return response.status(422).json({ errors: errors.array() });
   }
   next();
 },
];

const login = [
 body('email')
  .notEmpty().withMessage('Email tidak boleh kosong')
  .isEmail().withMessage('Email tidak valid'),
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

const forgetPassword = [
 body('email')
  .notEmpty().withMessage('Email tidak boleh kosong')
  .isEmail().withMessage('Email tidak valid'),
 body('new_password')
  .isLength({ min: 6 }).withMessage('Password harus memiliki minimal 6 karakter'),
 (request, response, next) => {
  const errors = validationResult(request);
  if (!errors.isEmpty()) {
   return response.status(422).json({ errors: errors.array() });
  }
  next();
 },
];

export { registerValidation, login, forgetPassword };
