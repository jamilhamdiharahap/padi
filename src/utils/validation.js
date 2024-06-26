import { body, validationResult, check } from 'express-validator';
import moment from 'moment';

const registerValidation = [
  body('full_name').notEmpty().withMessage('Nama lengkap tidak boleh kosong'),
  body('email').notEmpty().withMessage('Email tidak boleh kosong').isEmail().withMessage('Email tidak valid'),
  body('question').notEmpty().withMessage('Pertanyaan tidak boleh kosong'),
  body('date_of_birth').notEmpty().withMessage('Tanggal lahir tidak boleh kosong'),
  body('position').notEmpty().withMessage('Posisi tidak boleh kosong'),
  body('location_id').notEmpty().withMessage('Posisi tidak boleh kosong'),
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

const checkin = [
  check('check_in_time').custom((value, { req }) => {
    const formattedTimestamp = moment.unix(value).format('YYYY-MM-DD HH:mm:ss');
    if (moment(formattedTimestamp, 'YYYY-MM-DD HH:mm:ss', true).isValid()) {
      req.formattedCheckInTime = formattedTimestamp;
      return true;
    } else {
      throw new Error('Invalid timestamp format');
    }
  }),
  check('longitude').isFloat(),
  check('latitude').isFloat(),
  check('status').isIn(['CHECKIN']),
  check('work_type').isIn(['WFH', 'WFO', 'WFA']),
  (request, response, next) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
      return response.status(422).json({ errors: errors.array() });
    }
    next();
  }
]

const checkout = [
  check('check_out_time').custom((value, { req }) => {
    const formattedTimestamp = moment.unix(value).format('YYYY-MM-DD HH:mm:ss');
    if (moment(formattedTimestamp, 'YYYY-MM-DD HH:mm:ss', true).isValid()) {
      req.formattedCheckInTime = formattedTimestamp;
      return true;
    } else {
      throw new Error('Invalid timestamp format');
    }
  }),
  check('longitude').isFloat(),
  check('latitude').isFloat(),
  check('status').isIn(['CHECKOUT']),
  check('note').isIn(['ONPROGRESS', 'SELESAI']),
  check('activity').isLength({ min: 10, max: 1000 }).withMessage('Activity harus memiliki minimal 10 maksimal 1000 karakter'),
  (request, response, next) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
      return response.status(422).json({ errors: errors.array() });
    }
    next();
  }
]

const checkAccount = [
  body('email')
    .notEmpty().withMessage('Email tidak boleh kosong')
    .isEmail().withMessage('Email tidak valid'),
  body('question').notEmpty().withMessage('Question tidak boleh kosong'),
  body('question_answer').notEmpty().withMessage('Question Answer tidak boleh kosong'),
  (request, response, next) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
      return response.status(422).json({ errors: errors.array() });
    }
    next();
  },
];

const correction = [
  body('activity').notEmpty().withMessage('Activity tidak boleh kosong'),
  body('activity').isLength({ max: 1000 }).withMessage('Activity maksimal 1000 karakter'),
  body('note').notEmpty().withMessage('Note tidak boleh kosong'),
  (request, response, next) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
      return response.status(422).json({ errors: errors.array() });
    }
    next();
  },
];

export {
  registerValidation,
  login,
  forgetPassword,
  checkin,
  checkout,
  checkAccount,
  correction
};
