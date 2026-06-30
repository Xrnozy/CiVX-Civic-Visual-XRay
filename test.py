import re
import torch
from PIL import Image, ImageDraw
from transformers import AutoModel, AutoTokenizer, AutoProcessor


class LocateAnythingWorker:
    def __init__(self, model_path="nvidia/LocateAnything-3B", device="cuda", dtype=torch.bfloat16):
        self.device = device
        self.dtype = dtype

        self.tokenizer = AutoTokenizer.from_pretrained(
            model_path,
            trust_remote_code=True
        )

        self.processor = AutoProcessor.from_pretrained(
            model_path,
            trust_remote_code=True
        )

        self.model = AutoModel.from_pretrained(
            model_path,
            torch_dtype=dtype,
            trust_remote_code=True
        ).to(device).eval()

    @torch.no_grad()
    def predict(self, image, question, generation_mode="hybrid", max_new_tokens=2048):
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": image},
                    {"type": "text", "text": question},
                ],
            }
        ]

        text = self.processor.py_apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True
        )

        images, videos = self.processor.process_vision_info(messages)

        inputs = self.processor(
            text=[text],
            images=images,
            videos=videos,
            return_tensors="pt"
        ).to(self.device)

        pixel_values = inputs["pixel_values"].to(self.dtype)
        image_grid_hws = inputs.get("image_grid_hws", None)

        response = self.model.generate(
            pixel_values=pixel_values,
            input_ids=inputs["input_ids"],
            attention_mask=inputs["attention_mask"],
            image_grid_hws=image_grid_hws,
            tokenizer=self.tokenizer,
            max_new_tokens=max_new_tokens,
            use_cache=True,
            generation_mode=generation_mode,
            temperature=0.7,
            do_sample=True,
            top_p=0.9,
            repetition_penalty=1.1,
            verbose=True,
        )

        return response[0] if isinstance(response, tuple) else response

    def detect(self, image, categories):
        cats = "</c>".join(categories)
        prompt = f"Locate all the instances that matches the following description: {cats}."
        return self.predict(image, prompt)

    def ground_multi(self, image, phrase):
        prompt = f"Locate all the instances that match the following description: {phrase}."
        return self.predict(image, prompt)

    @staticmethod
    def parse_boxes(answer, image_width, image_height):
        boxes = []
        for m in re.finditer(r"<box><(\d+)><(\d+)><(\d+)><(\d+)></box>", answer):
            x1, y1, x2, y2 = [int(g) for g in m.groups()]
            boxes.append({
                "x1": x1 / 1000 * image_width,
                "y1": y1 / 1000 * image_height,
                "x2": x2 / 1000 * image_width,
                "y2": y2 / 1000 * image_height,
            })
        return boxes


def draw_boxes(image, boxes, output_path="output.jpg"):
    draw = ImageDraw.Draw(image)

    for box in boxes:
        draw.rectangle(
            [box["x1"], box["y1"], box["x2"], box["y2"]],
            outline="red",
            width=4
        )

    image.save(output_path)
    print(f"Saved result to {output_path}")


if __name__ == "__main__":
    worker = LocateAnythingWorker()

    img = Image.open("example.jpg").convert("RGB")

    # Resize if your GPU runs out of memory
    img.thumbnail((1280, 1280))

    answer = worker.detect(img, ["garbage", "pothole", "broken road"])
    print("Raw model answer:")
    print(answer)

    boxes = LocateAnythingWorker.parse_boxes(answer, img.width, img.height)
    print("Parsed boxes:")
    print(boxes)

    draw_boxes(img, boxes, "output.jpg")