#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// ==================== CONFIG ====================
const SOURCE_DIR = process.argv[2] || path.join(__dirname, '../../stui_tpl/html');
const OUTPUT_DIR = process.argv[3] || path.join(__dirname, '../views/stui');
const INDENT = '  ';

// Marker chars (using Unicode private use area to avoid collision with content)
const M = {
  VAR: '\uE000', RAW: '\uE001', INC: '\uE002', URL: '\uE003',
  IF: '\uE004', ELIF: '\uE005', ELSE: '\uE006', ENDIF: '\uE007',
  EACH: '\uE008', ENDEACH: '\uE009', UNLESS: '\uE00A', ENDUNLESS: '\uE00B',
  MACCMS: '\uE00C', PHP: '\uE00D', MCMT: '\uE00E', HTMLCMT: '\uE00F',
  DP: '\uE010',
  END: '\uE0FF',
};

const VAR_MAP = {
  vod_name: 'name', vod_pic: 'pic', vod_actor: 'actor', vod_director: 'director',
  vod_content: 'content', vod_year: 'year', vod_area: 'area', vod_lang: 'lang',
  vod_class: 'class', vod_tag: 'tags', vod_total: 'total', vod_serial: 'serial',
  vod_isend: 'isEnd', vod_hits: 'hits', vod_score: 'score', vod_remarks: 'remarks',
  vod_en: 'en', vod_sub: 'sub', vod_status: 'status', vod_letter: 'letter',
  vod_color: 'color', vod_id: '_id', vod_pic_slide: 'pic', vod_blurb: 'content',
  vod_copyright: 'copyright', vod_play_list: 'playList', vod_time_add: 'timeAdd',
  vod_time_hits: 'timeHits', vod_time_make: 'timeMake', vod_trysee: 'trySee',
  vod_weekday: 'weekday', vod_weight: 'weight', vod_level: 'level',
  topic_name: 'name', topic_pic: 'pic', topic_content: 'content', topic_id: '_id',
  topic_rel_vod: 'relVods',
  type_id: '_id', type_name: 'name', type_title: 'name', type_key: 'key',
  type_des: 'des', type_pid: 'pid', type_extend: 'extend',
  art_name: 'name', art_pic: 'pic', art_content: 'content', art_id: '_id',
  art_time: 'time', art_page_list: 'pageList',
  site_name: 'siteName', site_url: 'siteUrl', site_wapurl: 'siteWapurl',
  site_keywords: 'siteKeywords', site_description: 'siteDescription',
  site_tj: 'siteTj', site_logo: 'siteLogo', site_waplogo: 'siteWaplogo',
  site_qq: 'siteQq', site_email: 'siteEmail',
  path_tpl: 'pathTpl', path: 'path',
  user_status: 'userStatus', mob_status: 'mobStatus',
};

const OBJECT_MAP = { obj: 'vod', vo: 'item', vo1: 'section', vo2: 'child' };

const PAGING_MAP = {
  page_total: 'totalPages', page_current: 'current',
  page_prev: 'prev', page_next: 'next',
  page_url: 'baseUrl', record_total: 'recordTotal',
};

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

const report = { files: 0, converted: 0, manualWarnings: [], errors: [] };

function mapVar(f) { return VAR_MAP[f] || f; }
function objName(p) { return OBJECT_MAP[p] || p; }

const E = M.END; // shorthand

// ==================== PHASE 1: MacCMS → MARKERS ====================

function phase1(html) {
  const warnings = [];
  let out = html;

  // 1.0: MacCMS comment blocks <!--{* ... *}--> and <!--{ ... }-->
  out = out.replace(/<!--\{\*\s*([\s\S]*?)\s*\*\}-->/g, (_, inner) => `${M.MCMT}${inner.trim()}${E}`);
  out = out.replace(/<!--\{([\s\S]*?)\}-->/g, (_, inner) => `${M.MCMT}${inner.trim()}${E}`);

  // 1.1: Strip non-MacCMS HTML comments
  out = out.replace(/<!--(?!\{)([\s\S]*?)-->/g, (_, inner) => {
    const t = inner.trim();
    return t ? `${M.HTMLCMT}${t}${E}` : '';
  });

  // 1.2: {php}...{/php}
  out = out.replace(/\{php\}([\s\S]*?)\{\/php\}/g, (_, code) => {
    warnings.push(`MANUAL: PHP code block (${code.trim().substring(0, 60).replace(/\n/g, ' ')}...)`);
    return `${M.PHP}${code.trim()}${E}`;
  });

  // 1.3: {maccms:* ...}...{/maccms:*}
  out = out.replace(/\{maccms:(\w+)([^}]*)\}([\s\S]*?)\{\/maccms:\1\}/g, (_, tag, attrs, content) => {
    const a = attrs.trim();
    warnings.push(`MANUAL: {maccms:${tag}${a ? ' ' + a : ''}} needs controller pre-query`);
    return `${M.MACCMS}${tag}||${a}||${content.trim()}${E}`;
  });

  // 1.4: {include file="..."}
  out = out.replace(/\{include file="([^"]+)"\s*\/?\}/g, (_, file) => `${M.INC}${file}${E}`);

  // 1.5: URL helpers
  out = out.replace(/\{:mac_url_vod_detail\(\$vo\)\}/g, `${M.URL}vd:item${E}`);
  out = out.replace(/\{:mac_url_vod_detail\(\$obj\)\}/g, `${M.URL}vd:vod${E}`);
  out = out.replace(/\{:mac_url_vod_play\(\$obj,\s*\[[^\]]*\]\)\}/g, `${M.URL}vp:vod${E}`);
  out = out.replace(/\{:mac_url_type\(\$vo\)\}/g, `${M.URL}vt:item${E}`);
  out = out.replace(/\{:mac_url_type\(\$vo1\)\}/g, `${M.URL}vt:section${E}`);
  out = out.replace(/\{:mac_url_img\(\$vo\.vod_pic\)\}/g, `${M.URL}img:item${E}`);
  out = out.replace(/\{:mac_url_img\(\$vo\.vod_pic_slide\)\}/g, `${M.URL}img:item${E}`);
  out = out.replace(/\{:mac_url_img\(\$obj\.vod_pic\)\}/g, `${M.URL}img:vod${E}`);
  out = out.replace(/\{:mac_url\('([^']+)'\)\}/g, (_, route) => `${M.URL}route:${route}${E}`);
  out = out.replace(/\{:mac_url_topic_detail\(\$vo\)\}/g, `${M.URL}td:item${E}`);
  out = out.replace(/\{:mac_url_topic_index\(\)\}/g, `${M.URL}ti${E}`);
  out = out.replace(/\{:mac_url_\w+\([^)]*\)\}/g, (m) => {
    warnings.push(`MANUAL: Complex URL helper: ${m.substring(0, 60)}`);
    return `${M.URL}complex${E}`;
  });

  // 1.6: Variables WITH filters (must come before simple)
  // Filters can contain Chinese chars, spaces, hyphens etc. Use [^|{}]+ for filter values
  out = out.replace(/\{\$(\w+)\.(\w+)((?:\|[^|{}]+)+)\}/g, (full, prefix, field, filtersRaw) => {
    const mapped = mapVar(field);
    const obj = objName(prefix);
    let expr = `${obj}.${mapped}`;
    const fparts = filtersRaw.split('|').filter(Boolean);
    for (const fp of fparts) {
      if (fp.startsWith("mac_substring=")) {
        expr = `${expr}.substring(0, ${fp.split('=')[1]})`;
      } else if (fp.startsWith("mac_default='")) {
        const def = fp.match(/mac_default='([^']*)'/)[1];
        expr = `${expr} || '${def}'`;
      } else if (fp === 'mac_filter_html') {
        expr = `stripHtml(${expr})`;
      } else if (fp.startsWith("mac_url_create='")) {
        const type = fp.match(/mac_url_create='(\w+)'/)[1];
        warnings.push(`MANUAL: |mac_url_create='${type}' filter — needs /vod/search/${type}/ URL helper`);
      } else if (fp === 'raw') {
        return `${M.RAW}${expr}${E}`;
      }
    }
    return `${M.VAR}${expr}${E}`;
  });

  // Also filtered maccms: {$maccms.site_logo|mac_default='...'|mac_url_img}
  out = out.replace(/\{\$maccms\.(\w+)((?:\|[^|{}]+)+)\}/g, (full, field, filtersRaw) => {
    const mapped = mapVar(field);
    let expr = `maccms.${mapped}`;
    const fparts = filtersRaw.split('|').filter(Boolean);
    for (const fp of fparts) {
      if (fp.startsWith("mac_default='")) {
        expr = `${expr} || '${fp.match(/mac_default='([^']*)'/)[1]}'`;
      }
    }
    return `${M.VAR}${expr}${E}`;
  });

  // 1.7: Simple variables (no filters)
  out = out.replace(/\{\$obj\.(\w+)\}/g, (_, f) => `${M.VAR}vod.${mapVar(f)}${E}`);
  out = out.replace(/\{\$obj\['(\w+)'\]\}/g, (_, f) => `${M.VAR}vod.${mapVar(f)}${E}`);
  out = out.replace(/\{\$vo\.(\w+)\}/g, (_, f) => `${M.VAR}item.${mapVar(f)}${E}`);
  out = out.replace(/\{\$vo1\.(\w+)\}/g, (_, f) => `${M.VAR}section.${mapVar(f)}${E}`);
  out = out.replace(/\{\$vo2\.(\w+)\}/g, (_, f) => `${M.VAR}child.${mapVar(f)}${E}`);
  out = out.replace(/\{\$maccms\.(\w+)\}/g, (_, f) => `${M.VAR}maccms.${mapVar(f)}${E}`);
  out = out.replace(/\{\$maccms\['(\w+)'\]\}/g, (_, f) => `${M.VAR}maccms.${mapVar(f)}${E}`);
  out = out.replace(/\{\$param\.(\w+)\}/g, (_, f) => `${M.VAR}param.${f}${E}`);
  out = out.replace(/\{\$param\['(\w+)'\]\}/g, (_, f) => `${M.VAR}param.${f}${E}`);
  out = out.replace(/\{\$__PAGING__\.(\w+)\}/g, (_, f) => `${M.VAR}paging.${PAGING_MAP[f] || f}${E}`);
  out = out.replace(/\{\$(\w+)\.(\w+)\}/g, (m, prefix, field) => {
    if (['obj', 'vo', 'vo1', 'vo2', 'maccms', 'param', '__PAGING__'].includes(prefix)) return m;
    return `${M.VAR}${prefix}.${mapVar(field)}${E}`;
  });
  out = out.replace(/\{\$(\w+)\}/g, (m, name) => {
    if (name === 'vo' || name === 'vo1' || name === 'vo2') return `${M.VAR}item${E}`;
    if (name === 'player_data') return `${M.RAW}playerData${E}`;
    if (name === 'player_js') return `${M.RAW}playerJs${E}`;
    return `${M.VAR}${name}${E}`;
  });

  // 1.8: Conditionals — block and inline
  out = convertConditionals(out);

  // 1.9: {volist name="list" id="vo"} / {/volist}
  out = out.replace(/\{volist name="(\w+)" id="(\w+)"(\s+key="(\w+)")?\s*\}/g, (_, list, id) => {
    if (id === 'vo') return `${M.EACH}${list}:item${E}`;
    if (id === 'vo1') return `${M.EACH}${list}:section${E}`;
    if (id === 'vo2') return `${M.EACH}${list}:child${E}`;
    return `${M.EACH}${list}:${id}${E}`;
  });
  out = out.replace(/\{\/volist\}/g, `${M.ENDEACH}${E}`);

  // 1.10: {empty name="..."}...{/empty}
  out = out.replace(/\{empty name="\$(\w+)\.(\w+)"\}/g, (_, prefix, field) =>
    `${M.UNLESS}${objName(prefix)}.${mapVar(field)}${E}`);
  out = out.replace(/\{empty name="\$param\['(\w+)'\]"\}/g, (_, f) => `${M.UNLESS}param.${f}${E}`);
  out = out.replace(/\{empty name="\$(\w+)"\}/g, (_, name) => `${M.UNLESS}${name}${E}`);
  out = out.replace(/\{\/empty\}/g, `${M.ENDUNLESS}${E}`);

  // 1.11: Complex PHP array access
  out = out.replace(/\{\$([a-zA-Z_]\w*)((?:\[['\w\]]+\])+)\}/g, (_, prefix, indices) => {
    const flat = indices.replace(/\[(['"])(\w+)\1\]/g, '.$2').replace(/\[\$\w+\[(['"]\w+['"])\](?:\]\))?/g, '.$1');
    warnings.push(`MANUAL: Complex array: \${${prefix}${indices}} → ${prefix}${flat.replace(/[^a-zA-Z0-9._]/g,'')}`);
    return `${M.VAR}${objName(prefix)}${flat.replace(/[^a-zA-Z0-9._]/g,'')}${E}`;
  });

  return { intermediate: out, warnings };
}

// ==================== CONDITIONALS ====================

function convertConditionals(text) {
  // Collect of all conditional markers
  const markers = [];
  let m;
  const ifRe = /\{if condition="([^"]*)"\}/g;
  const elifRe = /\{elseif condition="([^"]*)"\s*\/?\}/g;
  const elseRe = /\{else\s*\/?\}/g;
  const endRe = /\{\/if\}/g;
  while ((m = ifRe.exec(text)) !== null) markers.push({ p: m.index, l: m[0].length, t: 'IF', c: m[1] });
  while ((m = elifRe.exec(text)) !== null) markers.push({ p: m.index, l: m[0].length, t: 'ELIF', c: m[1] });
  while ((m = elseRe.exec(text)) !== null) markers.push({ p: m.index, l: m[0].length, t: 'ELSE' });
  while ((m = endRe.exec(text)) !== null) markers.push({ p: m.index, l: m[0].length, t: 'ENDIF' });
  if (!markers.length) return text;
  markers.sort((a, b) => a.p - b.p);

  let out = '', pos = 0;
  for (const mk of markers) {
    out += text.substring(pos, mk.p);
    if (mk.t === 'IF')      out += `${M.IF}${simplifyCond(mk.c)}${E}`;
    else if (mk.t === 'ELIF') out += `${M.ELIF}${simplifyCond(mk.c)}${E}`;
    else if (mk.t === 'ELSE') out += `${M.ELSE}${E}`;
    else if (mk.t === 'ENDIF') out += `${M.ENDIF}${E}`;
    pos = mk.p + mk.l;
  }
  out += text.substring(pos);
  return out;
}

function simplifyCond(cond) {
  let js = cond.trim();
  js = js.replace(/\$obj\.(\w+)/g, (_, f) => `vod.${mapVar(f)}`);
  js = js.replace(/\$obj\['(\w+)'\]/g, (_, f) => `vod.${mapVar(f)}`);
  js = js.replace(/\$vo\.(\w+)/g, (_, f) => `item.${mapVar(f)}`);
  js = js.replace(/\$vo1\.(\w+)/g, (_, f) => `section.${mapVar(f)}`);
  js = js.replace(/\$vo2\.(\w+)/g, (_, f) => `child.${mapVar(f)}`);
  js = js.replace(/\$maccms\.(\w+)/g, (_, f) => `maccms.${mapVar(f)}`);
  js = js.replace(/\$maccms\['(\w+)'\]/g, (_, f) => `maccms.${mapVar(f)}`);
  js = js.replace(/\$param\.(\w+)/g, (_, f) => `param.${f}`);
  js = js.replace(/\$param\['(\w+)'\]/g, (_, f) => `param.${f}`);
  js = js.replace(/\$(\w+)\.(\w+)/g, (_, p, f) => `${p}.${f}`);
  js = js.replace(/\$(\w+)/g, (_, v) => v);
  js = js.replace(/\beq\b/g, '===');
  js = js.replace(/\bne\b/g, '!==');
  js = js.replace(/\bneq\b/g, '!==');
  js = js.replace(/\bgt\b/g, '>');
  js = js.replace(/\blt\b/g, '<');
  js = js.replace(/\bge\b/g, '>=');
  js = js.replace(/\ble\b/g, '<=');
  return js;
}

// ==================== PHASE 2: MARKERS → PUG EXPRESSIONS ====================

function phase2(intermediate, warnings) {
  let out = intermediate;

  // Variables → #{...}
  out = out.replace(new RegExp(`${M.VAR}([^${M.END}]+)${E}`, 'g'), '#{$1}');
  // Raw → !{...}
  out = out.replace(new RegExp(`${M.RAW}([^${M.END}]+)${E}`, 'g'), '!{$1}');
  // Includes
  out = out.replace(new RegExp(`${M.INC}([^${M.END}]+)${E}`, 'g'), 'include $1');
  // HTML comments
  out = out.replace(new RegExp(`${M.HTMLCMT}([^${M.END}]+)${E}`, 'g'), '// $1');
  // MacCMS comments
  out = out.replace(new RegExp(`${M.MCMT}([^${M.END}]+)${E}`, 'g'), '//- $1');

  // URLs
  out = out.replace(new RegExp(`${M.URL}vd:item${E}`, 'g'), 'macUrl(`/vod/detail/id/${item._id}.html`)');
  out = out.replace(new RegExp(`${M.URL}vd:vod${E}`, 'g'), 'macUrl(`/vod/detail/id/${vod._id}.html`)');
  out = out.replace(new RegExp(`${M.URL}vp:vod${E}`, 'g'), 'macUrl(`/vod/play/id/${vod._id}/sid/1/nid/1.html`)');
  out = out.replace(new RegExp(`${M.URL}vt:item${E}`, 'g'), 'macUrl(`/vod/show/id/${item._id}.html`)');
  out = out.replace(new RegExp(`${M.URL}vt:section${E}`, 'g'), 'macUrl(`/vod/show/id/${section._id}.html`)');
  out = out.replace(new RegExp(`${M.URL}img:item${E}`, 'g'), 'item.pic');
  out = out.replace(new RegExp(`${M.URL}img:vod${E}`, 'g'), 'vod.pic');
  out = out.replace(new RegExp(`${M.URL}route:([^${M.END}]+)${E}`, 'g'), (_, route) => `macUrl('/${route}.html')`);
  out = out.replace(new RegExp(`${M.URL}td:item${E}`, 'g'), 'macUrl(`/topic/detail/id/${item._id}.html`)');
  out = out.replace(new RegExp(`${M.URL}ti${E}`, 'g'), "macUrl('/topic/index.html')");
  out = out.replace(new RegExp(`${M.URL}complex${E}`, 'g'), '(TODO: mac_url complex call)');

  // MacCMS blocks → manual comments
  out = out.replace(new RegExp(`${M.MACCMS}${E}`, 'g'), '//- MANUAL: maccms block (needs controller pre-query)');
  out = out.replace(new RegExp(`${M.MACCMS}[^${M.END}]*${E}`, 'g'), '//- MANUAL: maccms block (needs controller pre-query)');

  // PHP blocks
  out = out.replace(new RegExp(`${M.PHP}([^${M.END}]*)${E}`, 'g'), (_, code) => {
    const lns = code.trim().split('\n').slice(0, 2).map(l => `//-   ${l.trim()}`).join('\n');
    return `//- MANUAL: PHP code\n${lns}`;
  });

  // --- Process line-by-line: separate block-level from inline directives ---
  // Block-level = at line start; inline = embedded in HTML text content
  const allDirectiveChars = `${M.IF}${M.ELIF}${M.ELSE}${M.ENDIF}${M.EACH}${M.ENDEACH}${M.UNLESS}${M.ENDUNLESS}`;
  const startsWithDirectiveRe = new RegExp(`^\\s*[${allDirectiveChars}]`);
  const ilines = out.split('\n');
  let inlineCount = 0;

  for (let i = 0; i < ilines.length; i++) {
    let line = ilines[i];

    // Does this line have any directive markers?
    const hasDirective = new RegExp(`[${allDirectiveChars}]`).test(line);

    if (hasDirective) {
      if (startsWithDirectiveRe.test(line)) {
        // --- Block-level: convert to DP markers for Phase 3 indent tracking ---
        line = line.replace(new RegExp(`${M.IF}([^${M.END}]+)${E}`, 'g'), `${M.DP}IF:${E}$1`);
        line = line.replace(new RegExp(`${M.ELIF}([^${M.END}]+)${E}`, 'g'), `${M.DP}ELIF:${E}$1`);
        line = line.replace(new RegExp(`${M.ELSE}${E}`, 'g'), `${M.DP}ELSE${E}`);
        line = line.replace(new RegExp(`${M.ENDIF}${E}`, 'g'), `${M.DP}ENDIF${E}`);
        line = line.replace(new RegExp(`${M.EACH}([^${M.END}]+)${E}`, 'g'), (_, expr) => {
          const [list, id] = expr.split(':');
          if (id === 'item') return `${M.DP}EACH:${E}each item, index in ${list}`;
          if (id === 'section') return `${M.DP}EACH:${E}each section, index in ${list}`;
          if (id === 'child') return `${M.DP}EACH:${E}each child, index in ${list}`;
          return `${M.DP}EACH:${E}each ${id}, index in ${list}`;
        });
        line = line.replace(new RegExp(`${M.ENDEACH}${E}`, 'g'), `${M.DP}ENDEACH${E}`);
        line = line.replace(new RegExp(`${M.UNLESS}([^${M.END}]+)${E}`, 'g'), `${M.DP}UNLESS:${E}$1`);
        line = line.replace(new RegExp(`${M.ENDUNLESS}${E}`, 'g'), `${M.DP}ENDUNLESS${E}`);
      } else {
        // --- Inline: convert to INLINE markers for manual flagging in Phase 3 ---
        line = line.replace(new RegExp(`${M.IF}([^${M.END}]+)${E}`, 'g'), (_, c) => {
          inlineCount++;
          return `{{INLINE_IF:${c}}}`;
        });
        line = line.replace(new RegExp(`${M.ELIF}([^${M.END}]+)${E}`, 'g'), () => {
          return '{{INLINE_ELIF}}';
        });
        line = line.replace(new RegExp(`${M.ELSE}${E}`, 'g'), '{{INLINE_ELSE}}');
        line = line.replace(new RegExp(`${M.ENDIF}${E}`, 'g'), '{{INLINE_ENDIF}}');
      }
    }

    ilines[i] = line;
  }

  if (inlineCount > 0) {
    warnings.push(`MANUAL: ${inlineCount} inline conditionals embedded in text — needs structural Pug refactor`);
  }

  out = ilines.join('\n');

  // ---------- CLEANUP: any remaining stray markers ----------
  out = out.replace(new RegExp(`[${allDirectiveChars}]`, 'g'), '');
  out = out.replace(new RegExp(`${E}`, 'g'), '');

  return out;
}

// ==================== PHASE 3: HTML → PUG STRUCTURE ====================

function phase3(text) {
  const lines = text.split('\n');
  const output = [];
  let htmlIndent = 0;
  let dpStack = 0;

  const DP = M.DP; // shorthand

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) { output.push(''); continue; }

    // --- Block-level directive markers ---
    if (trimmed.startsWith(DP)) {
      const eff = htmlIndent + dpStack;
      const content = trimmed.substring(DP.length);

      if (content === 'ENDIF' || content === 'ENDEACH' || content === 'ENDUNLESS') {
        dpStack = Math.max(0, dpStack - 1);
        continue;
      }
      if (content === 'ELSE') {
        dpStack = Math.max(0, dpStack - 1);
        output.push(INDENT.repeat(htmlIndent + dpStack) + 'else');
        dpStack++;
        continue;
      }
      if (content.startsWith('IF:')) {
        const cond = content.substring(3);
        output.push(INDENT.repeat(eff) + `if ${cond}`);
        dpStack++;
        continue;
      }
      if (content.startsWith('ELIF:')) {
        const cond = content.substring(5);
        dpStack = Math.max(0, dpStack - 1);
        output.push(INDENT.repeat(htmlIndent + dpStack) + `else if ${cond}`);
        dpStack++;
        continue;
      }
      if (content.startsWith('EACH:')) {
        const expr = content.substring(5);
        output.push(INDENT.repeat(eff) + expr);
        dpStack++;
        continue;
      }
      if (content.startsWith('UNLESS:')) {
        const cond = content.substring(7);
        output.push(INDENT.repeat(eff) + `unless ${cond}`);
        dpStack++;
        continue;
      }
      // Cleanup any stray
      continue;
    }

    // --- Already a Pug directive? (include, //-, etc) ---
    if (/^(if |else |each |unless |case |when |default|include |extends |block |mixin |\/\/-|\/\/)/.test(trimmed)) {
      output.push(INDENT.repeat(htmlIndent + dpStack) + trimmed);
      continue;
    }

    // Skip DOCTYPE
    if (/^<!DOCTYPE/i.test(trimmed)) continue;

    // --- Process HTML line ---
    const eff = htmlIndent + dpStack;
    let openCount = 0, closeCount = 0;
    const parts = [];
    let rem = trimmed;

    while (rem.length > 0) {
      // Opening tag
      const openM = rem.match(/^<(\w+)((?:\s[^>]*)?)\s*(\/)?>/);
      if (openM) {
        const tag = openM[1].toLowerCase();
        const selfClose = !!openM[3] || isVoidElement(tag);
        parts.push({ t: 'open', tag, raw: openM[0] });
        openCount++;
        if (selfClose) openCount--;
        rem = rem.substring(openM[0].length);
        continue;
      }
      // Closing tag
      const closeM = rem.match(/^<\/(\w+)[^>]*>/);
      if (closeM) {
        parts.push({ t: 'close', raw: closeM[0] });
        closeCount++;
        rem = rem.substring(closeM[0].length);
        continue;
      }
      // Text up to next <
      const nextLt = rem.indexOf('<');
      if (nextLt === -1) {
        parts.push({ t: 'text', raw: rem });
        rem = '';
      } else if (nextLt === 0) {
        parts.push({ t: 'text', raw: '<' });
        rem = rem.substring(1);
      } else {
        parts.push({ t: 'text', raw: rem.substring(0, nextLt) });
        rem = rem.substring(nextLt);
      }
    }

    // Build Pug line
    let pugLine = '';

    for (const part of parts) {
      if (part.t === 'open') {
        const converted = convertTag(part);
        pugLine = pugLine ? pugLine + ' ' + converted : converted;
      } else if (part.t === 'close') {
        // Pug: don't emit closing tags
      } else if (part.t === 'text') {
        let text = part.raw;
        // If text contains inline conditional markers, collapse to a single MANUAL comment
        if (text.includes('{{INLINE_')) {
          text = ' // MANUAL: Inline conditional - needs structural Pug conversion';
        }
        if (text) {
          if (!pugLine) {
            pugLine = '| ' + text;
          } else {
            pugLine += ' ' + text;
          }
        }
      }
    }

    if (pugLine.trim()) {
      output.push(INDENT.repeat(eff) + pugLine);
    }
    htmlIndent += openCount - closeCount;
    if (htmlIndent < 0) htmlIndent = 0;
  }

  // Cleanup any remaining inline cond markers (shouldn't appear with new approach)
  const joined = output.join('\n');
  return joined.replace(/\[\[INLINE-COND:[^\]]+\]\]/g, '// MANUAL: inline conditional');
}

// ==================== TAG CONVERTER ====================

function convertTag(part) {
  const raw = part.raw;
  const m = raw.match(/^<(\w+)((?:\s[^>]*)?)\s*\/?>$/);
  if (!m) return part.tag;
  let [, tag, attrsStr] = m;
  tag = tag.toLowerCase();
  attrsStr = attrsStr || '';
  let pugAttrs = '';

  // Class (requires word boundary to avoid matching data-class etc.)
  const classM = attrsStr.match(/(?:^|\s)class="([^"]*)"/);
  if (classM) {
    const classes = classM[1].trim().split(/\s+/).filter(Boolean);
    if (classes.length) pugAttrs += classes.map(c => `.${c}`).join('');
    attrsStr = attrsStr.replace(/(^|\s)class="([^"]*)"/, '');
  }
  // ID (requires word boundary to avoid matching data-id etc.)
  const idM = attrsStr.match(/(?:^|\s)id="([^"]*)"/);
  if (idM && idM[1]) {
    pugAttrs += `#${idM[1]}`;
    attrsStr = attrsStr.replace(/(^|\s)id="([^"]*)"/, '');
  }
  // Remaining attributes
  const allAttrs = attrsStr.match(/([\w-]+)="([^"]*)"/g) || [];
  const parens = [];
  for (const attr of allAttrs) {
    const am = attr.match(/([\w-]+)="([^"]*)"/);
    if (!am) continue;
    let [, key, val] = am;
    const BOOLS = /^(checked|selected|disabled|required|readonly|autofocus|multiple|autoplay|loop|muted|controls|hidden|async|defer|nowrap)$/;
    if (BOOLS.test(key) && key === val) { parens.push(key); continue; }
    if (['href', 'src', 'data-original', 'action', 'poster', 'type', 'name', 'value',
         'placeholder', 'title', 'alt', 'target', 'rel', 'method', 'width', 'height',
         'border', 'cellpadding', 'cellspacing', 'colspan', 'rowspan', 'allowfullscreen',
         'frameborder', 'scrolling', 'style', 'onclick', 'onchange', 'onsubmit',
         'onfocus', 'onblur', 'onkeyup', 'onkeypress', 'data-id', 'data-type',
         'data-mid', 'data-cmd'].includes(key)) {
      parens.push(`${key}="${val}"`);
    } else if (key.startsWith('data-')) {
      parens.push(`${key}="${val}"`);
    } else {
      parens.push(`${key}="${val}"`);
    }
  }
  // Boolean bare attrs
  const boolBareMatch = attrsStr.match(/\b(checked|selected|disabled|required|readonly|autofocus|multiple|autoplay|loop|muted|controls|hidden|async|defer|nowrap)\b/g);
  if (boolBareMatch) {
    for (const b of boolBareMatch) {
      if (!parens.includes(b)) parens.push(b);
    }
  }
  if (parens.length) pugAttrs += `(${parens.join(', ')})`;
  return tag + pugAttrs;
}

function isVoidElement(tag) { return VOID_ELEMENTS.has(tag.toLowerCase()); }

// ==================== POST-PROCESS ====================

function postProcess(pug) {
  // Fix attribute values that should have #{} but don't (bare variable refs in attrs)
  pug = pug.replace(/\((.*?)data-original="([a-z_]+\.[a-z_]+)"(.*?)\)/g, '($1data-original="#{$2}"$3)');
  pug = pug.replace(/\((.*?)src="#\{([^}]+)\}([^"]*)"(.*?)\)/g, '($1src="#{$2}$3"$4)');
  pug = pug.replace(/\b(href|action)="(macUrl\([^"]+\))"/g, '$1=$2');
  pug = pug.replace(/\bhref="#\{maccms\.path\}"/g, 'href=macUrl("/")');
  // Fix double hash: ##{ → #{
  pug = pug.replace(/##\{/g, '#{');
  // Strip HTML comments on include lines
  pug = pug.replace(/^(\s*include\s+\S+)\s*\/\/.*$/gm, '$1');
  // Clean up consecutive blank lines
  pug = pug.replace(/\n{3,}/g, '\n\n');
  return pug;
}

function convertTemplate(html, srcLabel = 'inline.html') {
  if (!html.includes('{$') && !html.includes('{maccms:') && !html.includes('{:')) {
    return {
      pug: postProcess(phase3(phase2(html, []))),
      warnings: []
    };
  }

  const warnings = [];
  const phase1Result = phase1(html);
  warnings.push(...(phase1Result.warnings || []));
  const p2Output = phase2(phase1Result.intermediate, warnings);
  const pugRaw = phase3(p2Output);
  const finalPug = postProcess(pugRaw);

  return {
    pug: `//- Source: ${path.basename(srcLabel)}\n\n${finalPug}`,
    warnings: [...new Set(warnings)]
  };
}

// ==================== MAIN ====================

function convertFile(srcPath, destPath) {
  try {
    const html = fs.readFileSync(srcPath, 'utf-8');
    if (!html.includes('{$') && !html.includes('{maccms:') && !html.includes('{:')) {
      const pug = postProcess(phase3(phase2(html, [])));
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      fs.writeFileSync(destPath, pug);
      report.converted++;
      return { warnings: [] };
    }

    const converted = convertTemplate(html, srcPath);
    let finalPug = converted.pug;

    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    // Rewrite include paths relative to the output file's directory
    finalPug = finalPug.replace(/^(\s*)include\s+(\S+)/gm, (m, indent, incPath) => {
      const incClean = incPath.replace(/\.pug$/, '');
      if (incClean.includes('/')) {
        const destRelToRoot = path.relative(destDir, OUTPUT_DIR);
        if (destRelToRoot) {
          const depth = destRelToRoot.split(path.sep).length;
          const prefix = Array(depth).fill('..').join('/');
          return `${indent}include ${prefix}/${incClean}`;
        }
        return `${indent}include ${incClean}`;
      }
      return m;
    });

    const unique = converted.warnings;
    const headerLines = [`//- Source: ${path.basename(srcPath)}`];
    if (unique.length > 0) {
      headerLines.push(`//- ⚠ Manual work: ${unique.length} item(s)`);
      headerLines.push('//-');
      for (const w of unique) headerLines.push(`//-   ${w}`);
    } else {
      headerLines.push('//- ✓ No manual work needed');
    }

    fs.writeFileSync(destPath, headerLines.join('\n') + '\n\n' + finalPug);
    report.converted++;
    for (const w of unique) {
      report.manualWarnings.push({ file: path.basename(srcPath), warning: w });
    }
    return { warnings: unique };
  } catch (e) {
    report.errors.push({ file: srcPath, error: e.message });
    return { warnings: [] };
  }
}

function convertDir(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) { console.error('Source not found:', srcDir); return; }
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    if (entry.isDirectory()) {
      convertDir(src, path.join(destDir, entry.name));
    } else if (entry.name.endsWith('.html')) {
      report.files++;
      convertFile(src, path.join(destDir, entry.name.replace('.html', '.pug')));
    }
  }
}

// ==================== RUN ====================
if (require.main === module) {
  console.log('='.repeat(60));
  console.log('  MacCMS Template -> Pug Converter');
  console.log('='.repeat(60));
  console.log(`  Source: ${SOURCE_DIR}`);
  console.log(`  Output: ${OUTPUT_DIR}`);

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const srcStat = fs.statSync(SOURCE_DIR);
  if (srcStat.isFile()) {
    const dest = OUTPUT_DIR.endsWith('.pug')
      ? OUTPUT_DIR
      : path.join(OUTPUT_DIR, path.basename(SOURCE_DIR).replace('.html', '.pug'));
    report.files++;
    convertFile(SOURCE_DIR, dest);
  } else {
    convertDir(SOURCE_DIR, OUTPUT_DIR);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('  SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Files processed : ${report.files}`);
  console.log(`  Files converted : ${report.converted}`);
  console.log(`  Errors          : ${report.errors.length}`);
  console.log(`  Manual warnings : ${report.manualWarnings.length}`);

  if (report.manualWarnings.length > 0) {
    const byFile = {};
    for (const mw of report.manualWarnings) {
      (byFile[mw.file] = byFile[mw.file] || []).push(mw.warning);
    }
    console.log('\n  --- Manual migration items ---');
    for (const [file, warns] of Object.entries(byFile)) {
      console.log(`  ${file}: ${warns.length} item(s)`);
    }
  }

  if (report.errors.length > 0) {
    console.log('\n  --- Errors ---');
    for (const e of report.errors) console.log(`  ${e.file}: ${e.error}`);
  }

  console.log(`\n  Output: ${OUTPUT_DIR}`);
  console.log('  Done.');
}

module.exports = {
  phase1,
  phase2,
  phase3,
  postProcess,
  convertTemplate
};
