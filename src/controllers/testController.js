const testEndpoint = (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Test endpoint working correctly',
    timestamp: new Date().toISOString()
  });
};

export default {
  testEndpoint
};