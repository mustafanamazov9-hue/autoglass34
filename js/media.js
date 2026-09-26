/* Фото и видео для карусели «Работы».

   Как добавить:
   1. Положите файл в папку media/ (фото — .jpg/.webp, видео — .mp4 H.264).
      Имена латиницей и строчными буквами: rabota-01.jpg, zamena-lobovogo.mp4.
   2. Добавьте строку в список ниже. Порядок строк = порядок в карусели.

   type   — 'photo' или 'video'
   src    — путь к файлу от корня сайта, например 'media/rabota-01.jpg'
   title  — необязательно: подпись на слайде (например 'Замена лобового, Kia Rio')
   poster — необязательно, только для видео: картинка-обложка до запуска ролика

   Битый или отсутствующий файл сам пропадёт из карусели; если список пуст, показываются карточки-примеры. */
window.AG_MEDIA = [
  { type: 'photo', src: 'media/rabota-skol.jpg', title: 'Ремонт скола на лобовом стекле' },
  { type: 'video', src: 'media/video-01.mp4' },
  { type: 'photo', src: 'media/rabota-tonirovka.jpg', title: 'Тонировка стёкол' },
  { type: 'video', src: 'media/video-02.mp4' },
  { type: 'photo', src: 'media/rabota-mazda.jpg' }
];
