const asyncWrapper = require('../../middleware/asyncWrapper');
const File = require('../../utils/File');
const { join } = require('path');

// @desc      Update custom CSS file
// @route     PUT /api/config/0/css
// @access    Public
const updateCSS = asyncWrapper(async (req, res, next) => {
  const file = new File(join(__dirname, '../../data/flame.css'));
  file.write(req.body.styles, false);

  res.status(200).json({
    success: true,
    data: {},
  });
});

module.exports = updateCSS;
