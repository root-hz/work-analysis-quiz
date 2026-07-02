window.QUIZ_SETS = {
  work: {
    id: 'work',
    title: '工作分析习题集',
    subtitle: '即测即评 · 共 100 题',
    icon: '📚',
    theme: 'blue',
    info: [
      '判断题 30 · 单选题 40 · 多选题 30',
      '答错即时显示正确答案',
      '完成后汇总全部错题',
    ],
    questions: () => window.QUIZ_DATA,
  },
  marxism: {
    id: 'marxism',
    title: '马克思主义基本原理',
    subtitle: '26年春季练习题 · 共 262 题',
    icon: '📖',
    theme: 'red',
    info: [
      '单选题 158 · 多选题 104',
      '答错即时显示正确答案',
      '完成后汇总错题并评分',
    ],
    questions: () => window.MARXISM_QUIZ_DATA,
  },
};
