In the UI that’s in the monorepo zip right now: not yet — it only accepts one image.
	•	apps/web/components/JobCreateForm.tsx uses a single File | null
	•	it sends FormData with fd.append("image", file)
	•	the API route POST /v1/jobs (apps/api/src/server.ts) explicitly looks for one multipart file with fieldname "image"

So today: 1 reference image per job.

If you want the UI to support true multi-image upload, here’s the clean approach:

1) Web UI

Change the file input to multiple and store File[] instead of one file.

<input type="file" accept="image/*" multiple onChange={(e)=>setFiles(Array.from(e.target.files ?? []))} />

Then append each:

files.forEach(f => fd.append("images", f));

2) API

Update POST /v1/jobs to accept repeated "images" parts (or "image" repeated), collect them all, and write them as:
	•	jobs/<jobId>/uploads/ref_00.png
	•	jobs/<jobId>/uploads/ref_01.png
	•	…

Create multiple ArtifactType.UPLOAD rows (upload_0, upload_1, etc.)

3) Worker + core pipeline context

Change the context from:
	•	uploadPath: string
to:
	•	uploadPaths: string[]

Then in the pipeline:
	•	use uploadPaths[0] as the primary identity ref
	•	use the rest as secondary refs (back view / outfit detail / style)

4) Provider behavior

If the provider endpoint supports multiple refs (some do), pass them through.
If not, fallback to auto-stitching the refs into one sheet inside the pipeline and send that.
