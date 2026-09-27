'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/search.controller');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const v = require('../validators/search.validators');

router.get('/', requireAuth, validate(v.searchQuery, 'query'), ctrl.search);

module.exports = router;
