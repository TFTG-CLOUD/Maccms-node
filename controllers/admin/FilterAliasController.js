const FilterAliasSetting = require('../../models/FilterAliasSetting');
const { clearCache } = require('../../middleware/pageCache');
const { clearRuntimeCache } = require('../../utils/runtimeCache');
const {
  FILTER_ALIAS_FIELDS,
  clearFilterAliasSettingsCache,
  getFilterAliasSettings,
  parseAliasSettingsFromForm,
  stringifyAliasSettingsForForm
} = require('../../utils/filterAliasConfig');

async function invalidateFrontCaches() {
  await Promise.all([
    clearFilterAliasSettingsCache(),
    clearRuntimeCache('count:'),
    clearRuntimeCache('front:'),
    clearCache()
  ]);
}

class FilterAliasController {
  async index(req, res) {
    const setting = await getFilterAliasSettings(FilterAliasSetting);
    res.render('filter-alias/index', {
      fields: FILTER_ALIAS_FIELDS,
      formValues: stringifyAliasSettingsForForm(setting)
    });
  }

  async update(req, res) {
    const normalized = parseAliasSettingsFromForm(req.body);

    await FilterAliasSetting.findOneAndUpdate(
      { key: 'default' },
      {
        key: 'default',
        groups: normalized.groups
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    await invalidateFrontCaches();
    res.redirect('/admin/filter-alias');
  }
}

module.exports = FilterAliasController;
