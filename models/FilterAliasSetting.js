const mongoose = require('mongoose');

const aliasEntrySchema = new mongoose.Schema({
  canonical: { type: String, default: '' },
  aliases: [{ type: String }]
}, { _id: false });

const filterAliasSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'default' },
  groups: {
    area: { type: [aliasEntrySchema], default: () => [] },
    class: { type: [aliasEntrySchema], default: () => [] },
    lang: { type: [aliasEntrySchema], default: () => [] },
    actor: { type: [aliasEntrySchema], default: () => [] },
    director: { type: [aliasEntrySchema], default: () => [] },
    writer: { type: [aliasEntrySchema], default: () => [] }
  }
}, { timestamps: true });

module.exports = mongoose.model('FilterAliasSetting', filterAliasSettingSchema);
