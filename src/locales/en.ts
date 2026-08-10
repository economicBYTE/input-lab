import type { LocaleKeys } from './zh';

const en: Record<LocaleKeys, string> = {
  // nav
  'nav.logo.main': 'type',
  'nav.logo.sub': 'practice',
  'nav.documents': 'documents',
  'nav.history': 'history',

  // document list
  'doc.selectTitle': 'select a document to practice',
  'doc.importJSON': 'import JSON',
  'doc.new': '+ new',
  'doc.defaultCategory': 'default',
  'doc.emptyHint': 'no documents yet — click "+ new" to add practice content',
  'doc.recommendedDocs': 'recommended documents',
  'doc.allCategories': 'all',
  'doc.adding': 'adding...',
  'doc.add': 'add',
  'doc.renamedTo': 'added as: {title}',
  'doc.chars': 'chars',
  'doc.keypress': 'keypress',
  'doc.uncategorized': 'uncategorized',

  // document card actions
  'doc.edit': 'edit',
  'doc.del': 'del',
  'doc.confirm': 'confirm?',

  // import
  'import.failed': 'import failed',
  'import.close': 'close',
  'import.titleConflict': 'title conflict',
  'import.conflictMsg': 'document "{title}" already exists. Import as "{newTitle}"?',
  'import.import': 'import',
  'import.cancel': 'cancel',
  'import.parseFailed': 'Failed to parse JSON, please check the file format',
  'import.validateFailed': 'validation failed',

  // category
  'category.manage': 'manage categories',
  'category.name': 'category name',
  'category.update': 'update',
  'category.add': 'add',
  'category.cancel': 'cancel',
  'category.edit': 'edit',
  'category.del': 'del',
  'category.confirm': 'confirm?',
  'category.empty': 'no categories yet',
  'category.close': 'close',

  // document form
  'form.newDoc': 'new document',
  'form.editDoc': 'edit document',
  'form.title': 'title',
  'form.titlePlaceholder': 'e.g. Git Commands',
  'form.description': 'description (optional)',
  'form.descPlaceholder': 'short description',
  'form.simple': 'simple',
  'form.advanced': 'advanced',
  'form.content': 'content',
  'form.contentPlaceholder': 'type the practice content here (English only)',
  'form.contentItems': 'content items',
  'form.tipsPlaceholder': 'tips (optional)',
  'form.textPlaceholder': 'text content',
  'form.noKeysSet': 'no keys set',
  'form.addText': '+ text',
  'form.addKeypress': '+ keypress',
  'form.save': 'save',
  'form.cancel': 'cancel',

  // key recorder
  'key.pressKeys': 'press keys...',
  'key.record': 'record keys',

  // practice
  'practice.startHint': 'start typing...',
  'practice.kpm': 'kpm',
  'practice.errors': 'errors',
  'practice.progress': 'progress',
  'practice.caseInsensitive': 'Ignore Case',
  'practice.caseInsensitive.tip': 'Case differences are not counted as errors; remembered per document on this device',
  'practice.mode.strict': 'Speed',
  'practice.mode.free': 'Document',
  'practice.mode.tip': 'Speed: cannot advance on error / Document: error chars stay until Backspace',
  'practice.present.flow': 'Follow',
  'practice.present.qa': 'Recall',
  'practice.present.tip': 'Follow: answer always visible / Recall: question only, type from memory and press Enter',

  // qa
  'qa.answer': 'answer',
  'qa.peek': 'reveal answer',
  'qa.noQuestion': '(no prompt for this item — type the answer)',
  'qa.pressPrompt': 'press the shortcut…',
  'qa.hint.text': 'Enter to submit · hold Tab to reveal',
  'qa.hint.retryText': 'wrong — type it correctly once to continue',
  'qa.hint.keypress': 'press the shortcut · hold "reveal answer" for a hint',
  'qa.hint.retryKeys': 'wrong — press the correct combination to continue',
  'qa.accuracy': 'first try',
  'qa.peeked': 'revealed',
  'qa.result.items': 'correct',
  'qa.result.missed': 'missed on first try ({count})',

  // result
  'result.title': 'practice complete',
  'result.time': 'time',
  'result.kpm': 'kpm',
  'result.errors': 'errors',
  'result.chars': 'chars',
  'result.errorDetails': 'error details',
  'result.space': 'space',
  'result.enter': 'enter',
  'result.tab': 'tab',
  'result.retry': 'retry',
  'result.back': 'back',

  // history
  'history.title': 'practice history',
  'history.mostErrors': 'most frequent errors',
  'history.deletedDoc': 'deleted document',
  'history.kpm': 'kpm',
  'history.errors': 'errors',
  'history.time': 'time',
  'history.chars': 'chars',
  'history.empty': 'no practice history yet',
  'history.deleteRecord': 'delete record',
  'history.errorPractice.allTitle': 'frequent error practice',
  'history.errorPractice.allTip': 'Generate focused drills from your most frequent error chars across all records',
  'history.errorPractice.practiceAll': 'practice these',
  'history.errorPractice.boost': 'error boost',
  'history.errorPractice.boostTitle': 'error boost - {title}',
  'history.errorPractice.description': 'focused drill on {count} error chars',
  'history.errorPractice.recordTitle': 'error drill',

  // validation
  'validate.invalidJSON': 'Invalid JSON format',
  'validate.missingTitle': 'Missing or empty title field',
  'validate.descMustBeString': 'description must be a string',
  'validate.categoryMustBeString': 'category must be a string',
  'validate.contentMustBeArray': 'content must be a non-empty array',
  'validate.invalidItem': 'content[{i}] is not a valid object',
  'validate.invalidType': 'content[{i}].type must be "text" or "keypress"',
  'validate.textContentRequired': 'content[{i}].content must be a non-empty string (type is text)',
  'validate.keypressContentRequired': 'content[{i}].content must be a non-empty string array (type is keypress)',
  'validate.keypressItemsMustBeString': 'content[{i}].content array elements must all be strings',
  'validate.tipsMustBeString': 'content[{i}].tips must be a string',

  // speed test
  'speed.title': 'Speed Test',
  'speed.description': '{count} random characters speed practice',
  'speed.errorBoost': 'error boost',
  'speed.errorBoostTip': 'include error chars from last 5 speed tests',
  'speed.start': 'start',
};

export default en;
