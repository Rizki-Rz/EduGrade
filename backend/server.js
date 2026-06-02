const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

const nilaiRoutes = require('./routes/nilaiRoutes');
const siswaRoutes = require('./routes/siswaRoutes');

app.use('/nilai', nilaiRoutes);
app.use('/siswa', siswaRoutes);

app.listen(3000, () => {
    console.log('Server berjalan di port 3000');
});