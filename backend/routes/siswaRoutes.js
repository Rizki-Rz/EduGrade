const express = require('express');

const router = express.Router();

const {
    getSiswa,
    addSiswa,
    deleteSiswa
} = require('../controllers/siswaController');

router.get('/', getSiswa);
router.post('/', addSiswa);
router.delete('/:id', deleteSiswa);

module.exports = router;