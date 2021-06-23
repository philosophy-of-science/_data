const fs = require("fs");

const axios = require("axios");
const axiosCookieJarSupport = require("axios-cookiejar-support").default;
const tough = require("tough-cookie");
const cheerio = require("cheerio");
let Parser = require("rss-parser");
const { createCanvas, loadImage } = require("canvas");
const slugify = require("slugify");

axiosCookieJarSupport(axios);

const cookieJar = new tough.CookieJar();

const url =
  "https://www.journals.uchicago.edu/action/showFeed?type=etoc&feed=rss&jc=phos";

let parser = new Parser();

async function getFeed() {
  let { items } = await parser.parseURL(url);
  items.shift();
  return items;
}

async function formatData() {
  const data = await getFeed();
  const articles = data.map(async (item) => {
    const article = new Article(item);
    const abstract = await getAbstract(article.link);
    article.abstract = abstract;
    console.log(article);
    createThumbs(article);
    return article;
  });
  const formattedArticles = await Promise.all(articles);
  return formattedArticles;
}

function segment(title, length) {
  if (title.length < length) {
    return [title.trim()];
  }

  const mid = Math.round(title.length / 2);
  const breakSpot = title.indexOf(" ", mid);
  return [
    ...segment(title.substring(0, breakSpot).trim(), length),
    ...segment(title.substring(breakSpot).trim(), length),
  ];
}

function parseContentSnippet(snippet) {
  const arr = snippet.split(",");
  return {
    volume: arr[1].trim().replace(/\D/g, ""),
    issue: arr[2].trim().replace(/\D/g, ""),
    pages: arr[3].trim().replace("Page ", ""),
    date: arr[4].trim().replace(".", ""),
  };
}

class Article {
  constructor(item) {
    this.creator = item.creator;
    this.title = item.title.replace(/,$/, "");
    this.link = item.link;
    this.parsed = parseContentSnippet(item.contentSnippet);
    this.date = this.parsed.date;
    this.volume = this.parsed.volume;
    this.pages = this.parsed.pages;
    this.issue = this.parsed.issue;
    this.image = `/img/${slugify(this.title, { lower: true })}.png`;
    this.imageAbstract = `/img/${slugify(this.title, {
      lower: true,
    })}-abstract.png`;
  }
}

const articles = formatData();

function createTitleText(titleArr, ctx, type) {
  for (const title in titleArr) {
    if (type === "title") {
      ctx.font = "bold 70px Inter";
      ctx.fillStyle = "#000";
      ctx.fillText(titleArr[title], 94, 130 + 80 * title, 1412);
    } else {
      ctx.font = "40px Inter";
      ctx.fillStyle = "#eee";
      ctx.fillText(titleArr[title], 94, 140 + 60 * title, 1412);
    }
  }
}

function createThumbs(data) {
  const canvas = createCanvas(1600, 900);
  const ctx = canvas.getContext("2d");
  const title = data.title;
  const titleArr = segment(title, 45);
  const creator = data.creator;
  const slug = slugify(data.title, { lower: true });
  const pubDate = `Volume ${data.volume}, no. ${data.issue} (${data.date}): ${data.pages}`;
  loadImage("./_data/template.png").then((image) => {
    ctx.drawImage(image, 0, 0, 1600, 900);

    createTitleText(titleArr, ctx, "title");

    ctx.font = "65px Inter";
    ctx.fillStyle = "#fff";
    ctx.fillText(creator, 700, 652);

    ctx.font = "light 30px Inter";
    ctx.fillStyle = "#eee";
    ctx.fillText(pubDate, 700, 652 + 70);

    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(`./_site/img/${slug}.png`, buffer);
  });

  // Abstract Thumb
  const abstractCanvas = createCanvas(1600, 900);
  const abstractCtx = abstractCanvas.getContext("2d");
  abstractCtx.fillStyle = "#3a3a3a";
  abstractCtx.fillRect(0, 0, 1600, 900);
  abstractCtx.font = "bold 70px Inter";
  abstractCtx.fillStyle = "#878787";
  abstractCtx.fillText("ABSTRACT", 94, 830);
  const abstract = data.abstract;
  createTitleText(segment(abstract, 90), abstractCtx, "abstract");
  const abstractBuffer = abstractCanvas.toBuffer("image/png");
  fs.writeFileSync(`./_site/img/${slug}-abstract.png`, abstractBuffer);
}

async function getAbstract(url) {
  const { data } = await axios.get(url, {
    jar: cookieJar,
    withCredentials: true,
  });
  const selector = cheerio.load(data);
  const abstract = selector(".abstractSection.abstractInFull > p").text();
  return abstract;
}

module.exports = articles;
