export const SEMANGAT_CHANNEL_ID = '1033107468936544332';
export const SEMANGAT_TIME_ZONE = 'Asia/Jakarta';

export const SEMANGAT_MESSAGES = [
  'Hari ini tidak harus sempurna. Cukup mulai dari satu hal kecil yang bisa kamu selesaikan.',
  'Pelan-pelan tetap maju. Langkah kecil yang konsisten lebih kuat daripada niat besar yang berhenti.',
  'Kamu sudah melewati banyak hari berat. Hari ini juga bisa kamu hadapi satu langkah demi satu langkah.',
  'Fokus pada hal yang bisa kamu kendalikan hari ini. Sisanya boleh menunggu giliran.',
  'Jangan ukur dirimu dari lelahnya hari ini saja. Usahamu tetap punya nilai, bahkan saat hasilnya belum terlihat.',
  'Ambil napas, rapikan pikiran, lalu mulai lagi. Tidak apa-apa bergerak pelan asal tidak menyerah.',
  'Hari ini adalah kesempatan untuk menjadi sedikit lebih baik dari kemarin, bukan harus langsung menjadi sempurna.',
  'Kalau terasa berat, pecah jadi bagian kecil. Satu tugas selesai tetap berarti kemajuan.',
  'Tetap semangat. Kerja baik yang dilakukan dengan sabar akan menemukan jalannya.',
  'Kamu tidak perlu menunggu mood bagus untuk mulai. Mulai dulu, semangat sering datang setelah langkah pertama.'
];

export function dailySemangat(date = new Date()) {
  const index = dailySemangatIndex(date, {
    count: SEMANGAT_MESSAGES.length
  });

  return {
    footer: formatSemangatDate(date),
    message: SEMANGAT_MESSAGES[index],
    title: 'Semangat hari ini'
  };
}

export function dailySemangatIndex(date = new Date(), options = {}) {
  const count = options.count ?? SEMANGAT_MESSAGES.length;

  if (!Number.isInteger(count) || count < 1) {
    throw new Error('count must be a positive integer.');
  }

  const parts = zonedDateParts(date);
  const seed = Number(`${parts.year}${parts.month}${parts.day}`);

  return seed % count;
}

export function formatSemangatDate(date = new Date()) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    timeZone: SEMANGAT_TIME_ZONE,
    weekday: 'long',
    year: 'numeric'
  }).format(date);
}

function zonedDateParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: SEMANGAT_TIME_ZONE,
    year: 'numeric'
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => ['day', 'month', 'year'].includes(part.type))
      .map((part) => [part.type, part.value])
  );

  return {
    day: values.day,
    month: values.month,
    year: values.year
  };
}
