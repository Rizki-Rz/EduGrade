const express = require('express');
const router = express.Router();

const {
    inputNilai,
    getNilai,
    hapusNilai,
    importNilai
} = require('../controllers/nilaiController');

router.post('/', inputNilai);
router.post('/import', importNilai);

router.get('/', getNilai);

router.delete('/:id', hapusNilai);

module.exports = router;