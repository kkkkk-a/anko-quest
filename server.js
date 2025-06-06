const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// publicフォルダの中身を静的ファイルとして提供
app.use(express.static(path.join(__dirname, 'public')));

// ルートアクセス時に index.html を表示
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
