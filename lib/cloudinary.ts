import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };

// Upload a CV (PDF) as a private/authenticated raw asset so it's never on a public URL.
export async function uploadCv(buffer: Buffer, contentType: string, userId: string) {
  const dataUri = `data:${contentType};base64,${buffer.toString("base64")}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: "sasa/cvs",
    resource_type: "raw",
    type: "authenticated",
    public_id: `${userId}-${Date.now()}`,
    overwrite: true,
  });
  return { publicId: result.public_id, bytes: result.bytes };
}

// Upload a mentor-applicant's resume. Unlike the CV above this is a normal delivery
// URL (unguessable public_id) so an admin can open it directly when reviewing.
export async function uploadResume(buffer: Buffer, contentType: string, userId: string) {
  const dataUri = `data:${contentType};base64,${buffer.toString("base64")}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: "sasa/mentor-resumes",
    resource_type: "raw",
    public_id: `${userId}-${Date.now()}`,
    overwrite: true,
  });
  return { url: result.secure_url, bytes: result.bytes };
}

// Upload an image (e.g. a mentor's photo). Returns a normal delivery URL.
export async function uploadImage(buffer: Buffer, contentType: string, folder: string) {
  const dataUri = `data:${contentType};base64,${buffer.toString("base64")}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: `sasa/${folder}`,
    resource_type: "image",
    overwrite: true,
  });
  return { url: result.secure_url, bytes: result.bytes };
}
