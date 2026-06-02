const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

const nilaiRoutes = require('./routes/nilaiRoutes');
const siswaRoutes = require('./routes/siswaRoutes');

app.use('/nilai', nilaiRoutes);
app.use('/siswa', siswaRoutes);

const PORT = process.env.PORT || 3000;
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server berjalan di port ${PORT}`);
    });
}

module.exports = app;