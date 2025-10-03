// src/lib/s3Upload.ts
export async function uploadFirst({
  file,
  folder
}: {
  file: File;
  folder: "profiles" | "digital-cards" | "portfolios";
}) {
  // step 1: ask backend for upload url + final public fileUrl
  const presign = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // optional: send the size so backend can block huge files early
      "x-upload-length": String(file.size)
    },
    credentials: "include",
    body: JSON.stringify({
      folder,
      fileType: file.type,
      fileName: file.name
    })
  }).then(r => r.json());

  if (!presign?.success) throw new Error(presign?.message || "presign failed");

  const { uploadUrl, fileUrl } = presign;

  // step 2: PUT file to S3 directly
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file
  });
  if (!put.ok) throw new Error("S3 upload failed");

  // step 3: return the final URL immediately (use it in your form)
  return fileUrl as string;
}
