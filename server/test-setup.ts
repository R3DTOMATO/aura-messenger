// Set test environment variables before any module loads
process.env.JWT_SECRET ||= "test-secret-test-secret-test-secret-test-secret";
process.env.NODE_ENV ||= "test";
