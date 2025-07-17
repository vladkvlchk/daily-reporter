const { execSync } = require("child_process");
const { OpenAI } = require("openai");
const ora = require("ora").default;
const path = require("path");
const fs = require("fs");

require("dotenv").config();

// 🔑 Замініть на ваш ключ
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

// ⬇️ Хардкод списку проєктів
const projects = [
  {
    name: "Sky Market",
    path: "/Applications/MAMP/htdocs",
  },
  {
    name: "Skyservice Dashboard",
    path: "/Users/vlad/Documents/projects/skyservice-dashboard-vue",
  }
];

// ⬇️ Аргументи
const AUTHOR = process.argv[2] || "prostoandrei9@gmail.com";
const SINCE = process.argv[3] || "1 day ago";

if (!AUTHOR) {
  console.error('Використання: node multi-daily-report.js "Автор" ["Період"]');
  process.exit(1);
}

// Основна логіка
(async () => {
  let allCommits = [];

  for (const project of projects) {
    const fullPath = project.path;

    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️ Пропущено: ${project.name} — шлях не існує`);
      continue;
    }

    try {
      const output = execSync(
        `git log --since="${SINCE}" --author="${AUTHOR}" --pretty=format:"%s"`,
        {
          cwd: fullPath,
          encoding: "utf-8",
        }
      ).trim();

      if (output) {
        const commits = output.split("\n");
        allCommits.push({ name: project.name, commits });
      }
    } catch (err) {
      console.error(`❌ Помилка при обробці ${project.name}: ${err.message}`);
    }
  }

  if (allCommits.length === 0) {
    console.log("❗️ Не знайдено жодного коміту для звіту.");
    return;
  }

  const spinner = ora("Генеруємо загальний звіт...").start();

  const combinedCommitsText = allCommits
    .map(
      (project) =>
        `📁 ${project.name}:\n${project.commits
          .map((c) => `- ${c}`)
          .join("\n")}`
    )
    .join("\n\n");

    const prompt = `
    На основі цього списку git-комітів згенеруй щоденний звіт у стислому вигляді. Для кожного проєкту виведи один рядок у форматі:

    ProjectName: коротко, через кому, що було зроблено.

    Уникай повторів і зайвих вступів типу "вчора я працював над...". Просто по суті.

    Ось коміти для кожного проєкту:

    ${combinedCommitsText}
    `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
    });

    spinner.succeed("Готово!");

    console.log("\n📄 Звіт:");
    console.log(response.choices[0].message.content);
  } catch (err) {
    spinner.fail("Помилка при зверненні до OpenAI");
    console.error("❌", err.message);
  }
})();
