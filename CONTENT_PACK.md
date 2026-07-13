# Формат контент-пака

Контент-пак — JSON-файл для атомарного импорта навыков, повторяющихся действий и
квестов. Текущая версия формата — `1`.

```json
{
  "format": "life-rpg-content-pack",
  "formatVersion": 1,
  "name": "Пример",
  "skills": [
    {
      "key": "reading",
      "name": "Чтение",
      "attributeCode": "mind",
      "description": "Осмысленное чтение книг",
      "icon": "📚",
      "color": "#6366F1"
    }
  ],
  "taskTemplates": [
    {
      "title": "Читать 20 минут",
      "description": "Без уведомлений и параллельных дел",
      "skillKey": "reading",
      "baseXp": 20,
      "difficulty": "easy",
      "recurrenceType": "weekdays",
      "weekdays": [1, 2, 3, 4, 5]
    }
  ],
  "quests": [
    {
      "title": "Прочитать одну книгу",
      "description": "Выбрать, прочитать и законспектировать",
      "type": "side",
      "attributeCode": "mind",
      "rewardXp": 150,
      "manualCompletion": true,
      "steps": [
        { "title": "Выбрать книгу", "isRequired": true },
        { "title": "Дочитать", "isRequired": true },
        { "title": "Сделать конспект", "isRequired": false }
      ]
    }
  ]
}
```

Допустимые значения:

- `attributeCode`: `body`, `mind`, `resources`, `social`, `discipline`, `creation`;
- `difficulty`: `easy`, `normal`, `hard`, `epic`;
- `recurrenceType`: `daily` или `weekdays`; для `weekdays` обязательны дни `1–7`;
- `type`: `main`, `side`, `long_term`;
- `baseXp`: `5–250`, `rewardXp`: `0–10000`;
- `icon`: `✨`, `💪`, `🧠`, `💼`, `🤝`, `🎨`, `⚡`, `📚`;
- `color`: `#6366F1`, `#0EA5E9`, `#14B8A6`, `#22C55E`, `#F59E0B`,
  `#F97316`, `#EC4899`, `#8B5CF6`.

`key` связывает шаблоны с навыками внутри одного файла и не сохраняется в БД.
Повторный импорт идентичного контента безопасен: записи пропускаются. Если совпадает
название, но отличаются параметры, весь импорт отменяется и возвращается список конфликтов.
Частичный импорт не выполняется.

Полный пользовательский экспорт имеет другой маркер — `life-rpg-export`. Его импорт
восстанавливает профиль, контент и прогресс с заменой текущих данных после подтверждения.
