# MediaUploadSystem
Did as part of my Final Year Project, all code was written by me

**This isn't functional without api keys etc**


3 parts

**Video processing**
- Used FFMPEG
- converts videos to webm and images to webp, in order to make calls to server lighter and speed up media heavy web app home page

  **Explicit Imagery Detection**
  - Used GCP Cloud vision to detect innappropriate imagery
  - At time of submission, image detection was fully functional, video detection was to be implemented later due as vision ai didnt support video
 
  **Uploading to cloud**
  -Uploading media to google cloud storage
