// Settings come from environment variables, so CI can switch them without code changes.
module.exports = {
  PORT: Number(process.env.PORT) || 3000,
  // BUGGY=1 turns on two planted bugs (README "Planted bugs") so we can prove the tests catch them.
  BUGGY: process.env.BUGGY === '1',
};
