const zh = {
  // nav
  'nav.logo.main': 'type',
  'nav.logo.sub': 'practice',
  'nav.documents': '文档',
  'nav.history': '历史',

  // document list
  'doc.selectTitle': '选择一个文档开始练习',
  'doc.importJSON': '导入 JSON',
  'doc.new': '+ 新建',
  'doc.defaultCategory': '默认',
  'doc.emptyHint': '还没有文档 — 点击 "+ 新建" 添加练习内容',
  'doc.recommendedDocs': '推荐文档',
  'doc.adding': '添加中...',
  'doc.add': '添加',
  'doc.renamedTo': '已添加，重命名为: {title}',
  'doc.chars': '字符',
  'doc.keypress': '按键',
  'doc.uncategorized': '未分类',

  // document card actions
  'doc.edit': '编辑',
  'doc.del': '删除',
  'doc.confirm': '确认?',

  // import
  'import.failed': '导入失败',
  'import.close': '关闭',
  'import.titleConflict': '标题冲突',
  'import.conflictMsg': '文档 "{title}" 已存在，是否导入为 "{newTitle}"？',
  'import.import': '导入',
  'import.cancel': '取消',
  'import.parseFailed': 'JSON 解析失败，请检查文件格式',
  'import.validateFailed': '校验失败',

  // category
  'category.manage': '管理分类',
  'category.name': '分类名称',
  'category.update': '更新',
  'category.add': '添加',
  'category.cancel': '取消',
  'category.edit': '编辑',
  'category.del': '删除',
  'category.confirm': '确认?',
  'category.empty': '暂无分类',
  'category.close': '关闭',

  // document form
  'form.newDoc': '新建文档',
  'form.editDoc': '编辑文档',
  'form.title': '标题',
  'form.titlePlaceholder': '如: Git Commands',
  'form.description': '描述 (可选)',
  'form.descPlaceholder': '简短描述',
  'form.simple': '简单',
  'form.advanced': '高级',
  'form.content': '内容',
  'form.contentPlaceholder': '在此输入练习内容（仅英文）',
  'form.contentItems': '内容条目',
  'form.tipsPlaceholder': '提示 (可选)',
  'form.textPlaceholder': '文本内容',
  'form.noKeysSet': '未设置按键',
  'form.addText': '+ 文本',
  'form.addKeypress': '+ 按键',
  'form.save': '保存',
  'form.cancel': '取消',

  // key recorder
  'key.pressKeys': '按下按键...',
  'key.record': '录入按键',

  // practice
  'practice.startHint': '开始输入...',
  'practice.kpm': 'kpm',
  'practice.errors': '错误',
  'practice.progress': '进度',
  'practice.caseInsensitive': '忽略大小写',
  'practice.mode.strict': '速度模式',
  'practice.mode.free': '文档模式',
  'practice.mode.tip': '速度：错字不前进 / 文档：错字标红需 Backspace 删除',

  // result
  'result.title': '练习完成',
  'result.time': '用时',
  'result.kpm': 'kpm',
  'result.errors': '错误',
  'result.chars': '字符',
  'result.errorDetails': '错误详情',
  'result.space': '空格',
  'result.enter': '回车',
  'result.tab': '制表',
  'result.retry': '重试',
  'result.back': '返回',

  // history
  'history.title': '练习历史',
  'history.mostErrors': '最常出错',
  'history.deletedDoc': '已删除文档',
  'history.kpm': 'kpm',
  'history.errors': '错误',
  'history.time': '用时',
  'history.chars': '字符',
  'history.empty': '暂无练习记录',
  'history.deleteRecord': '删除记录',
  'history.errorPractice.allTitle': '常错字符练习',
  'history.errorPractice.allTip': '将所有记录中最常出错的字符组合生成专项练习',
  'history.errorPractice.practiceAll': '练习这些字符',
  'history.errorPractice.boost': '错误加强练习',
  'history.errorPractice.boostTitle': '错误加强 - {title}',
  'history.errorPractice.description': '聚焦 {count} 个错字的专项练习',
  'history.errorPractice.recordTitle': '错字练习',

  // validation
  'validate.invalidJSON': '无效的 JSON 格式',
  'validate.missingTitle': '缺少 title 字段或 title 为空',
  'validate.descMustBeString': 'description 必须是字符串',
  'validate.categoryMustBeString': 'category 必须是字符串',
  'validate.contentMustBeArray': 'content 必须是非空数组',
  'validate.invalidItem': 'content[{i}] 不是有效的对象',
  'validate.invalidType': 'content[{i}].type 必须是 "text" 或 "keypress"',
  'validate.textContentRequired': 'content[{i}].content 必须是非空字符串（type 为 text）',
  'validate.keypressContentRequired': 'content[{i}].content 必须是非空字符串数组（type 为 keypress）',
  'validate.keypressItemsMustBeString': 'content[{i}].content 数组中的元素必须都是字符串',
  'validate.tipsMustBeString': 'content[{i}].tips 必须是字符串',

  // speed test
  'speed.title': '随机速度测试',
  'speed.description': '{count} 个随机字符速度练习',
  'speed.errorBoost': '错误加强',
  'speed.errorBoostTip': '将最近 5 次速测的错误字符加入练习',
  'speed.start': '开始',
} as const;

export default zh;
export type LocaleKeys = keyof typeof zh;
