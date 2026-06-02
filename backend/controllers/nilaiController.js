const pool = require('../db');
const hitungPredikat = require('../fuzzy/fuzzyLogic');

exports.inputNilai = async (req, res) => {

    try {

        const {
            siswa_id,
            matematika,
            bahasa_indonesia,
            bahasa_inggris,
            ipa
        } = req.body;

        // VALIDASI
        if (
            matematika > 100 ||
            bahasa_indonesia > 100 ||
            bahasa_inggris > 100 ||
            ipa > 100
        ) {
            return res.status(400).json({
                message: 'Nilai tidak boleh lebih dari 100'
            });
        }

        // VALIDASI 1 KALI INPUT
        const cek = await pool.query(
            'SELECT * FROM nilai WHERE siswa_id = $1',
            [siswa_id]
        );

        if (cek.rows.length > 0) {
            return res.status(400).json({
                message: 'Siswa sudah input nilai'
            });
        }

        // HITUNG RATA-RATA
        const rataRata =
            (
                matematika +
                bahasa_indonesia +
                bahasa_inggris +
                ipa
            ) / 4;

        // PROSES FUZZY
        const hasilFuzzy = hitungPredikat(rataRata);

        // SIMPAN DATABASE
        await pool.query(
            `
            INSERT INTO nilai
            (
                siswa_id,
                matematika,
                bahasa_indonesia,
                bahasa_inggris,
                ipa,
                rata_rata,
                predikat
            )

            VALUES ($1,$2,$3,$4,$5,$6,$7)
            `,
            [
                siswa_id,
                matematika,
                bahasa_indonesia,
                bahasa_inggris,
                ipa,
                rataRata,
                hasilFuzzy.predikat
            ]
        );

        res.json({
            message: 'Nilai berhasil disimpan',
            rataRata,
            fuzzy: hasilFuzzy
        });

    } catch (error) {

        res.status(500).json({
            message: error.message
        });

    }
};

exports.getNilai = async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT
                nilai.id,
                siswa.id as siswa_id,
                siswa.nama,
                siswa.kelas,

                nilai.matematika,
                nilai.bahasa_indonesia,
                nilai.bahasa_inggris,
                nilai.ipa,

                nilai.rata_rata,
                nilai.predikat

            FROM nilai

            JOIN siswa
            ON siswa.id = nilai.siswa_id

            ORDER BY siswa.nama ASC
        `);

        const formattedRows = result.rows.map(row => {
            const fuzzyData = hitungPredikat(parseFloat(row.rata_rata));
            return {
                ...row,
                fuzzy: fuzzyData
            };
        });

        res.json(formattedRows);

    } catch (error) {

        res.status(500).json({
            message: error.message
        });

    }
};

exports.hapusNilai = async (req, res) => {

    try {

        const { id } = req.params;

        await pool.query(
            'DELETE FROM nilai WHERE id = $1',
            [id]
        );

        res.json({
            message: 'Data berhasil dihapus'
        });

    } catch (error) {

        res.status(500).json({
            message: error.message
        });

    }
};

exports.importNilai = async (req, res) => {
    try {
        const { data, overwrite } = req.body;

        if (!Array.isArray(data) || data.length === 0) {
            return res.status(400).json({
                message: 'Data import tidak valid atau kosong'
            });
        }

        const results = [];
        let successCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        let failedCount = 0;

        for (const row of data) {
            const {
                nis,
                nama,
                kelas,
                matematika,
                bahasa_indonesia,
                bahasa_inggris,
                ipa
            } = row;

            // Validasi data minimal
            if (!nis) {
                results.push({
                    nis: 'N/A',
                    nama: nama || 'N/A',
                    status: 'failed',
                    message: 'NIS wajib diisi'
                });
                failedCount++;
                continue;
            }

            const mtk = parseInt(matematika);
            const ind = parseInt(bahasa_indonesia);
            const ing = parseInt(bahasa_inggris);
            const ipaNum = parseInt(ipa);

            if (isNaN(mtk) || isNaN(ind) || isNaN(ing) || isNaN(ipaNum) ||
                mtk < 0 || mtk > 100 || ind < 0 || ind > 100 || ing < 0 || ing > 100 || ipaNum < 0 || ipaNum > 100) {
                results.push({
                    nis,
                    nama: nama || 'N/A',
                    status: 'failed',
                    message: 'Nilai harus berupa angka antara 0 - 100'
                });
                failedCount++;
                continue;
            }

            try {
                // 1. Cari siswa berdasarkan NIS
                let siswaId = null;
                const checkSiswa = await pool.query('SELECT id, nama, kelas FROM siswa WHERE nis = $1', [String(nis).trim()]);

                if (checkSiswa.rows.length > 0) {
                    siswaId = checkSiswa.rows[0].id;
                } else {
                    // Jika siswa tidak ada, daftarkan otomatis jika nama dan kelas lengkap
                    if (nama && kelas) {
                        const newSiswa = await pool.query(
                            'INSERT INTO siswa (nis, nama, kelas) VALUES ($1, $2, $3) RETURNING id',
                            [String(nis).trim(), nama.trim(), kelas.trim()]
                        );
                        siswaId = newSiswa.rows[0].id;
                    } else {
                        results.push({
                            nis,
                            nama: nama || 'N/A',
                            status: 'failed',
                            message: 'Siswa belum terdaftar (kolom Nama/Kelas kosong untuk pendaftaran otomatis)'
                        });
                        failedCount++;
                        continue;
                    }
                }

                // 2. Hitung rata-rata dan predikat fuzzy
                const rataRata = (mtk + ind + ing + ipaNum) / 4;
                const hasilFuzzy = hitungPredikat(rataRata);

                // 3. Cek apakah data nilai sudah ada
                const checkNilai = await pool.query('SELECT id FROM nilai WHERE siswa_id = $1', [siswaId]);

                if (checkNilai.rows.length > 0) {
                    if (overwrite) {
                        // Perbarui nilai yang ada
                        await pool.query(
                            `UPDATE nilai SET 
                                matematika = $1, 
                                bahasa_indonesia = $2, 
                                bahasa_inggris = $3, 
                                ipa = $4, 
                                rata_rata = $5, 
                                predikat = $6 
                             WHERE siswa_id = $7`,
                            [mtk, ind, ing, ipaNum, rataRata, hasilFuzzy.predikat, siswaId]
                        );
                        results.push({
                            nis,
                            nama: nama || (checkSiswa.rows.length > 0 ? checkSiswa.rows[0].nama : ''),
                            status: 'updated',
                            message: 'Nilai berhasil diperbarui'
                        });
                        updatedCount++;
                    } else {
                        results.push({
                            nis,
                            nama: nama || (checkSiswa.rows.length > 0 ? checkSiswa.rows[0].nama : ''),
                            status: 'skipped',
                            message: 'Siswa sudah dinilai (tidak di-overwrite)'
                        });
                        skippedCount++;
                    }
                } else {
                    // Masukkan nilai baru
                    await pool.query(
                        `INSERT INTO nilai 
                        (siswa_id, matematika, bahasa_indonesia, bahasa_inggris, ipa, rata_rata, predikat)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                        [siswaId, mtk, ind, ing, ipaNum, rataRata, hasilFuzzy.predikat]
                    );
                    results.push({
                        nis,
                        nama: nama || (checkSiswa.rows.length > 0 ? checkSiswa.rows[0].nama : ''),
                        status: 'success',
                        message: 'Nilai berhasil di-import'
                    });
                    successCount++;
                }

            } catch (err) {
                results.push({
                    nis,
                    nama: nama || 'N/A',
                    status: 'failed',
                    message: err.message
                });
                failedCount++;
            }
        }

        res.json({
            message: 'Proses import selesai',
            summary: {
                total: data.length,
                success: successCount,
                updated: updatedCount,
                skipped: skippedCount,
                failed: failedCount
            },
            details: results
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
};