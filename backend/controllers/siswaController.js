const pool = require('../db');

exports.getSiswa = async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT *
            FROM siswa
            ORDER BY nama ASC
        `);

        res.json(result.rows);

    } catch (error) {

        res.status(500).json({
            message: error.message
        });

    }
};

exports.addSiswa = async (req, res) => {
    try {
        const { nis, nama, kelas } = req.body;

        if (!nis || !nama || !kelas) {
            return res.status(400).json({
                message: 'NIS, Nama, dan Kelas wajib diisi'
            });
        }

        // Cek apakah NIS sudah ada
        const cek = await pool.query('SELECT * FROM siswa WHERE nis = $1', [nis]);
        if (cek.rows.length > 0) {
            return res.status(400).json({
                message: 'NIS sudah terdaftar'
            });
        }

        const result = await pool.query(
            'INSERT INTO siswa (nis, nama, kelas) VALUES ($1, $2, $3) RETURNING *',
            [nis, nama, kelas]
        );

        res.json({
            message: 'Siswa berhasil ditambahkan',
            siswa: result.rows[0]
        });
    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
};

exports.deleteSiswa = async (req, res) => {
    try {
        const { id } = req.params;

        await pool.query('DELETE FROM siswa WHERE id = $1', [id]);

        res.json({
            message: 'Siswa berhasil dihapus'
        });
    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
};