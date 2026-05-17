const config = require('../../config');
const Vod = require('../../models/Vod');
const Type = require('../../models/Type');
const { seoReplace } = require('../../utils/helpers');
const {
  normalizeMediaList,
  resolveTypeSelection,
  selectNavTypes
} = require('../../utils/front');
const { readThroughCache } = require('../../utils/runtimeCache');

const HOME_CARD_FIELDS = '_id name actor pic remarks serial isEnd';
const HOME_RANK_FIELDS = '_id name remarks';

class IndexController {
  async index(req, res) {
    const filterAliasLookup = res.locals.filterAliasLookup || {};
    const allTypes = Array.isArray(res.locals.allTypes) && res.locals.allTypes.length
      ? res.locals.allTypes
      : await Type.find({ mid: 1, status: true }).sort({ sort: 1 }).lean();
    const parentTypes = (Array.isArray(res.locals.types) && res.locals.types.length
      ? res.locals.types
      : selectNavTypes(allTypes)).map((type) => ({ ...type, active: false }));

    const categorySections = await readThroughCache(
      `front:home:${config.templateTheme}`,
      Math.max(1, Number(config.frontHomeCacheTime || 120)) * 1000,
      async () => {
        const sections = await Promise.all(
          parentTypes.map(async (parentType) => {
            const typeContext = resolveTypeSelection(allTypes, parentType._id, filterAliasLookup);
            const typeFilter = typeContext.filterTypeIds.length ? { $in: typeContext.filterTypeIds } : parentType._id;
            const [vods, sideVods] = await Promise.all([
              Vod.find({ type: typeFilter, status: 1 })
                .select(HOME_CARD_FIELDS)
                .sort({ hitsWeek: -1 })
                .limit(12)
                .lean(),
              Vod.find({ type: typeFilter, status: 1 })
                .select(HOME_RANK_FIELDS)
                .sort({ updatedAt: -1 })
                .limit(15)
                .lean()
            ]);

            if (!vods.length) return null;

            return {
              type: typeContext.rootType || parentType,
              displayName: typeContext.displayName || parentType.name,
              children: typeContext.subTypes,
              vods: normalizeMediaList(vods),
              sideVods: normalizeMediaList(sideVods)
            };
          })
        );

        return sections.filter(Boolean);
      }
    );

    const seoTemplates = res.locals.seoSettings || config.seo;
    const seo = {
      title: seoReplace(seoTemplates.index.title, {}, config),
      keywords: seoReplace(seoTemplates.index.keywords, {}, config),
      description: seoReplace(seoTemplates.index.description, {}, config)
    };

    res.render('stui/index', {
      maccms: config,
      types: parentTypes,
      categorySections,
      links: config.friendLinks || [],
      param: {},
      seo
    });
  }
}

module.exports = IndexController;
