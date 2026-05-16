const bcrypt = require('bcrypt');
async function test() {
    const hash = '$2b$10$wO/L2vD9zJ.m.6Bf0A9qUOP.5pG/b.XzXqH0eT09z.L.E/W.fOQ.S';
    const isMatch = await bcrypt.compare('admin123', hash);
    console.log("Match:", isMatch);
}
test();
