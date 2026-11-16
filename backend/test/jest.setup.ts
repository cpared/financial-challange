if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
} else {
  process.env.DATABASE_URL ??=
    'postgresql://test:test@localhost:5432/cocos_challenge_test?schema=public';
}
process.env.PORT ??= '3000';
