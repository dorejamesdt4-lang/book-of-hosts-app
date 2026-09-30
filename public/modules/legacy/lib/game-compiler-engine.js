// lib/game-compiler-engine.js
//
// Plain-JS port of three mechanics borrowed from a design reference
// (Fisher-Yates-driven deterministic compilation, a status enum, a
// pre-save compliance audit) — rebuilt for THIS repo's actual stack:
// no Node, no TypeScript, no Supabase. No build step. Load via a
// normal <script> tag, same as script.js and seumas-deterministic-engine.js.
//
// Three pieces, one file since that's what was asked for:
//   1. Compliance check  -- tiered banned-term scan before anything
//      gets archived.
//   2. Status derivation -- a discrete status per "role" in a compiled
//      package (works for card-deck roles or any future mystery-style
//      content — generic on purpose).
//   3. Compile + archive -- runs 1 and 2, and only saves a package to
//      localStorage if it passes. Includes a JSON export/download,
//      since this repo has no backend to write to directly.

(function () {
  // =======================================================================
  // 1. COMPLIANCE CHECK
  // =======================================================================
  //
  // SCOPE NOTE: BANNED_TERMS_STRICT_12 below is a real starter list of
  // mild UK profanity for 12+ content -- stricter than the naughty/filthy
  // tiers, which explicitly allow real swearing per SEUMAS_PERSONA and so
  // have no word list at all (word-blocking doesn't apply to a tier that
  // permits swearing by design). This deliberately does NOT include
  // slurs, explicit sexual terms, or targeted-harassment language --
  // compiling that kind of list isn't something to hand-write into a
  // code file, even for a blocking purpose. checkTextCompliance() below
  // takes an optional pluggable checker so a real moderation
  // service/library can be wired in for that category later without
  // touching this file's structure.

  var BANNED_TERMS_STRICT_12 = ['damn', 'hell', 'crap', 'bloody', 'bugger', 'arse', 'piss']
  var BANNED_TERMS_BY_TIER = {
    '12': BANNED_TERMS_STRICT_12,
    mild: [], // SEUMAS_PERSONA allows damn/hell-level words at 18+ mild -- nothing to block on wording alone
    naughty: [], // real swearing explicitly permitted -- word-level blocking doesn't apply
    filthy: [], // same as naughty
  }

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  function findWholeWordMatches(text, term) {
    var pattern = new RegExp('\\b' + escapeRegex(term) + '\\b', 'gi')
    var indices = []
    var match
    while ((match = pattern.exec(text)) !== null) {
      indices.push(match.index)
    }
    return indices
  }

  function checkTextCompliance(text, tier, additionalChecker) {
    var violations = []
    var terms = BANNED_TERMS_BY_TIER[tier] || []

    terms.forEach(function (term) {
      findWholeWordMatches(text, term).forEach(function (index) {
        violations.push({ term: term, index: index })
      })
    })

    if (additionalChecker) {
      violations = violations.concat(additionalChecker(text) || [])
    }

    return { passed: violations.length === 0, violations: violations }
  }

  function checkPackageCompliance(entries, tier, textFields, additionalChecker) {
    var fields = textFields || ['title', 'text']
    var allViolations = []

    entries.forEach(function (entry) {
      fields.forEach(function (field) {
        if (typeof entry[field] !== 'string') return
        var result = checkTextCompliance(entry[field], tier, additionalChecker)
        allViolations = allViolations.concat(result.violations)
      })
    })

    return { passed: allViolations.length === 0, violations: allViolations }
  }

  // =======================================================================
  // 2. STATUS DERIVATION
  // =======================================================================
  //
  // Generic on purpose: works for card-deck "roles" today, and for any
  // future mystery-style content with a knowledge graph, without
  // rewriting this function. Statuses: 'innocent' | 'suspect' |
  // 'target_assigned' | 'cleared' -- matches the dashboard mockup.

  function deriveStatuses(entities, links) {
    var suspectedIds = {}
    ;(links || []).forEach(function (link) {
      if (link.relation === 'thinks_suspicious') suspectedIds[link.to_id] = true
    })

    var statuses = {}
    entities.forEach(function (entity) {
      if (entity.is_target) {
        statuses[entity.id] = 'target_assigned'
      } else if (suspectedIds[entity.id]) {
        statuses[entity.id] = 'suspect'
      } else {
        statuses[entity.id] = 'innocent'
      }
    })
    return statuses
  }

  // =======================================================================
  // 3. COMPILE + ARCHIVE
  // =======================================================================
  //
  // No Supabase here -- this repo has no backend. "Archive" means
  // localStorage (small, per-browser, matches the existing
  // 'seumasDatabase' pattern already in script.js) plus a JSON
  // download, since a static site can't write back to the repo itself.
  // A different localStorage KEY than the existing database-upload
  // console uses, so the two features never collide.

  var ARCHIVE_KEY = 'seumasCompiledGamesArchive'

  function loadArchive() {
    try {
      var raw = localStorage.getItem(ARCHIVE_KEY)
      return raw ? JSON.parse(raw) : []
    } catch (e) {
      return []
    }
  }

  function saveArchive(entries) {
    try {
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(entries))
      return true
    } catch (e) {
      return false
    }
  }

  function compileAndArchive(options) {
    var entries = options.entries || []
    var tier = options.tier || '12'
    var textFields = options.textFields
    var entities = options.entities || []
    var links = options.links || []
    var additionalChecker = options.additionalChecker
    var meta = options.meta || {}

    var compliance = checkPackageCompliance(entries, tier, textFields, additionalChecker)

    if (!compliance.passed) {
      return { archived: false, reason: 'Failed the pre-compilation compliance audit -- not saved.', compliance: compliance }
    }

    var statuses = entities.length ? deriveStatuses(entities, links) : null

    var record = {
      id: 'archived-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
      created_at: new Date().toISOString(),
      tier: tier,
      compliance_passed: true,
      statuses: statuses,
      entries: entries,
      meta: meta,
    }

    var archive = loadArchive()
    archive.push(record)
    var saved = saveArchive(archive)

    if (!saved) {
      return { archived: false, reason: 'Passed compliance but localStorage write failed (likely full or unavailable).', compliance: compliance, record: record }
    }

    return { archived: true, record: record, compliance: compliance }
  }

  function downloadArchive() {
    var archive = loadArchive()
    var blob = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' })
    var url = URL.createObjectURL(blob)
    var a = document.createElement('a')
    a.href = url
    a.download = 'seumas-compiled-games-archive.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  window.GameCompilerEngine = {
    checkTextCompliance: checkTextCompliance,
    checkPackageCompliance: checkPackageCompliance,
    deriveStatuses: deriveStatuses,
    compileAndArchive: compileAndArchive,
    loadArchive: loadArchive,
    downloadArchive: downloadArchive,
  }
})()
