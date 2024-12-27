document.addEventListener("DOMContentLoaded", () => {
    const credentialsForm = document.getElementById("credentials-form");
    const fileForm = document.getElementById("file-form");
    const progressSection = document.getElementById("progress-section");
    const progressFill = document.getElementById("progress-fill");
    const progressText = document.getElementById("progress-text");
  
    credentialsForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(credentialsForm);
      
      const response = await fetch('/upload-credentials', { method: 'POST', body: formData });
      if (response.ok) {
        alert('Credentials uploaded successfully!');
        fileForm.style.display = 'block';
      } else {
        alert('Failed to upload credentials.');
      }
    });
  
    fileForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(fileForm);
  
      progressSection.style.display = 'block';
      progressFill.style.width = '0%';
      progressText.textContent = 'Upload Progress: 0%';
  
      const source = new EventSource('/progress');
      source.onmessage = (event) => {
        const progress = Number(event.data);
        if (progress >= 0) {
          progressFill.style.width = `${progress}%`;
          progressText.textContent = `Upload Progress: ${progress}%`;
        } else {
          alert('Error during upload.');
          source.close();
        }
      };
  
      const response = await fetch('/upload', { method: 'POST', body: formData });
      if (response.ok) {
        alert(await response.text());
        source.close();
      } else {
        alert('Upload failed.');
        source.close();
      }
    });
  });
  