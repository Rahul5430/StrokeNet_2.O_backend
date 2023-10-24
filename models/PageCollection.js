const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema({
  id: String,
  page_title:String,
  page_content: String,
  status: Number,
  created: Date
});

const Page = mongoose.model('Page', pageSchema);

module.exports = Page;