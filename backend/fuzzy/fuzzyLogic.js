function fuzzyRendah(x) {

    if (x <= 60) {
        return 1;
    }

    if (x >= 70) {
        return 0;
    }

    return (70 - x) / 10;
}

function fuzzySedang(x) {

    if (x <= 60 || x >= 85) {
        return 0;
    }

    if (x === 75) {
        return 1;
    }

    if (x > 60 && x < 75) {
        return (x - 60) / 15;
    }

    return (85 - x) / 10;
}

function fuzzyTinggi(x) {

    if (x <= 75) {
        return 0;
    }

    if (x >= 90) {
        return 1;
    }

    return (x - 75) / 15;
}

function hitungPredikat(rataRata) {

    const rendah = fuzzyRendah(rataRata);
    const sedang = fuzzySedang(rataRata);
    const tinggi = fuzzyTinggi(rataRata);

    let predikat = '';

    const max = Math.max(rendah, sedang, tinggi);

    if (max === rendah) {
        predikat = 'Kurang';
    } else if (max === sedang) {
        predikat = 'Cukup';
    } else {
        predikat = 'Baik';
    }

    return {
        rendah,
        sedang,
        tinggi,
        predikat
    };
}

module.exports = hitungPredikat;