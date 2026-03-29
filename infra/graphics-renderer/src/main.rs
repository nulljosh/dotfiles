use nalgebra as na;
use na::{Matrix4, Point3, Vector3, Vector4};
use std::f32::consts::PI;

const WIDTH: usize = 800;
const HEIGHT: usize = 600;

// Color struct
#[derive(Clone, Copy, Debug)]
struct Color {
    r: u8,
    g: u8,
    b: u8,
}

impl Color {
    fn new(r: u8, g: u8, b: u8) -> Self {
        Color { r, g, b }
    }

    fn white() -> Self {
        Color { r: 255, g: 255, b: 255 }
    }

    fn black() -> Self {
        Color { r: 0, g: 0, b: 0 }
    }

    fn red() -> Self {
        Color { r: 255, g: 0, b: 0 }
    }

    fn green() -> Self {
        Color { r: 0, g: 255, b: 0 }
    }

    fn blue() -> Self {
        Color { r: 0, g: 0, b: 255 }
    }

    fn yellow() -> Self {
        Color { r: 255, g: 255, b: 0 }
    }

    fn cyan() -> Self {
        Color { r: 0, g: 255, b: 255 }
    }

    fn magenta() -> Self {
        Color { r: 255, g: 0, b: 255 }
    }
}

// Framebuffer with Z-buffer
struct Framebuffer {
    pixels: Vec<Color>,
    zbuffer: Vec<f32>,
    width: usize,
    height: usize,
}

impl Framebuffer {
    fn new(width: usize, height: usize) -> Self {
        let size = width * height;
        Framebuffer {
            pixels: vec![Color::black(); size],
            zbuffer: vec![f32::INFINITY; size],
            width,
            height,
        }
    }

    fn set_pixel(&mut self, x: usize, y: usize, color: Color, z: f32) {
        if x >= self.width || y >= self.height {
            return;
        }
        let idx = y * self.width + x;
        if z < self.zbuffer[idx] {
            self.zbuffer[idx] = z;
            self.pixels[idx] = color;
        }
    }

    fn clear(&mut self) {
        self.pixels.fill(Color::black());
        self.zbuffer.fill(f32::INFINITY);
    }

    fn get_pixels(&self) -> &[Color] {
        &self.pixels
    }
}

// 2D Rasterizer
fn draw_line(fb: &mut Framebuffer, x0: i32, y0: i32, x1: i32, y1: i32, color: Color, z: f32) {
    let dx = (x1 - x0).abs();
    let dy = (y1 - y0).abs();
    let sx = if x0 < x1 { 1 } else { -1 };
    let sy = if y0 < y1 { 1 } else { -1 };
    let mut err = dx - dy;
    let mut x = x0;
    let mut y = y0;

    loop {
        if x >= 0 && x < WIDTH as i32 && y >= 0 && y < HEIGHT as i32 {
            fb.set_pixel(x as usize, y as usize, color, z);
        }
        if x == x1 && y == y1 {
            break;
        }
        let e2 = 2 * err;
        if e2 > -dy {
            err -= dy;
            x += sx;
        }
        if e2 < dx {
            err += dx;
            y += sy;
        }
    }
}

fn draw_circle(fb: &mut Framebuffer, cx: i32, cy: i32, radius: i32, color: Color, z: f32) {
    let mut x = radius;
    let mut y = 0;
    let mut err = 0;

    while x >= y {
        fb.set_pixel((cx + x) as usize, (cy + y) as usize, color, z);
        fb.set_pixel((cx - x) as usize, (cy + y) as usize, color, z);
        fb.set_pixel((cx + x) as usize, (cy - y) as usize, color, z);
        fb.set_pixel((cx - x) as usize, (cy - y) as usize, color, z);
        fb.set_pixel((cx + y) as usize, (cy + x) as usize, color, z);
        fb.set_pixel((cx - y) as usize, (cy + x) as usize, color, z);
        fb.set_pixel((cx + y) as usize, (cy - x) as usize, color, z);
        fb.set_pixel((cx - y) as usize, (cy - x) as usize, color, z);

        if err <= 0 {
            y += 1;
            err += 2 * y + 1;
        } else {
            x -= 1;
            err -= 2 * x + 1;
        }
    }
}

fn draw_triangle(
    fb: &mut Framebuffer,
    p0: (i32, i32),
    p1: (i32, i32),
    p2: (i32, i32),
    color: Color,
    z: f32,
) {
    draw_line(fb, p0.0, p0.1, p1.0, p1.1, color, z);
    draw_line(fb, p1.0, p1.1, p2.0, p2.1, color, z);
    draw_line(fb, p2.0, p2.1, p0.0, p0.1, color, z);
}

fn draw_rect(
    fb: &mut Framebuffer,
    x: i32,
    y: i32,
    w: i32,
    h: i32,
    color: Color,
    z: f32,
) {
    draw_line(fb, x, y, x + w, y, color, z);
    draw_line(fb, x + w, y, x + w, y + h, color, z);
    draw_line(fb, x + w, y + h, x, y + h, color, z);
    draw_line(fb, x, y + h, x, y, color, z);
}

// 3D Transforms
fn create_rotation_x(angle: f32) -> Matrix4<f32> {
    let c = angle.cos();
    let s = angle.sin();
    Matrix4::new(
        1.0, 0.0, 0.0, 0.0,
        0.0, c, -s, 0.0,
        0.0, s, c, 0.0,
        0.0, 0.0, 0.0, 1.0,
    )
}

fn create_rotation_y(angle: f32) -> Matrix4<f32> {
    let c = angle.cos();
    let s = angle.sin();
    Matrix4::new(
        c, 0.0, s, 0.0,
        0.0, 1.0, 0.0, 0.0,
        -s, 0.0, c, 0.0,
        0.0, 0.0, 0.0, 1.0,
    )
}

fn create_rotation_z(angle: f32) -> Matrix4<f32> {
    let c = angle.cos();
    let s = angle.sin();
    Matrix4::new(
        c, -s, 0.0, 0.0,
        s, c, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        0.0, 0.0, 0.0, 1.0,
    )
}

fn create_translation(tx: f32, ty: f32, tz: f32) -> Matrix4<f32> {
    Matrix4::new(
        1.0, 0.0, 0.0, tx,
        0.0, 1.0, 0.0, ty,
        0.0, 0.0, 1.0, tz,
        0.0, 0.0, 0.0, 1.0,
    )
}

fn create_scale(sx: f32, sy: f32, sz: f32) -> Matrix4<f32> {
    Matrix4::new(
        sx, 0.0, 0.0, 0.0,
        0.0, sy, 0.0, 0.0,
        0.0, 0.0, sz, 0.0,
        0.0, 0.0, 0.0, 1.0,
    )
}

fn create_projection(fov: f32, aspect: f32, near: f32, far: f32) -> Matrix4<f32> {
    let f = 1.0 / (fov / 2.0).tan();
    let c = (far + near) / (near - far);
    let d = (2.0 * far * near) / (near - far);
    Matrix4::new(
        f / aspect, 0.0, 0.0, 0.0,
        0.0, f, 0.0, 0.0,
        0.0, 0.0, c, d,
        0.0, 0.0, -1.0, 0.0,
    )
}

// Lighting model
fn calculate_lighting(normal: Vector3<f32>, light_dir: Vector3<f32>) -> f32 {
    let light = light_dir.normalize();
    let n = normal.normalize();
    ((n.dot(&light)).max(0.0) * 0.8 + 0.2).min(1.0)
}

// Cube mesh
struct Vertex {
    pos: Point3<f32>,
    normal: Vector3<f32>,
}

fn create_cube() -> (Vec<Vertex>, Vec<(usize, usize, usize)>) {
    let vertices = vec![
        Vertex { pos: Point3::new(-1.0, -1.0, -1.0), normal: Vector3::new(0.0, 0.0, -1.0) },
        Vertex { pos: Point3::new(1.0, -1.0, -1.0), normal: Vector3::new(0.0, 0.0, -1.0) },
        Vertex { pos: Point3::new(1.0, 1.0, -1.0), normal: Vector3::new(0.0, 0.0, -1.0) },
        Vertex { pos: Point3::new(-1.0, 1.0, -1.0), normal: Vector3::new(0.0, 0.0, -1.0) },
        Vertex { pos: Point3::new(-1.0, -1.0, 1.0), normal: Vector3::new(0.0, 0.0, 1.0) },
        Vertex { pos: Point3::new(1.0, -1.0, 1.0), normal: Vector3::new(0.0, 0.0, 1.0) },
        Vertex { pos: Point3::new(1.0, 1.0, 1.0), normal: Vector3::new(0.0, 0.0, 1.0) },
        Vertex { pos: Point3::new(-1.0, 1.0, 1.0), normal: Vector3::new(0.0, 0.0, 1.0) },
    ];

    let faces = vec![
        (0, 1, 2), (0, 2, 3), // front
        (4, 6, 5), (4, 7, 6), // back
        (0, 4, 5), (0, 5, 1), // bottom
        (2, 6, 7), (2, 7, 3), // top
        (0, 3, 7), (0, 7, 4), // left
        (1, 5, 6), (1, 6, 2), // right
    ];

    (vertices, faces)
}

fn project_point(p: Point3<f32>) -> (i32, i32, f32) {
    let z = p.z + 5.0; // adjust z for perspective
    let scale = 300.0 / z.max(0.1);
    let x = (p.x * scale + WIDTH as f32 / 2.0) as i32;
    let y = (p.y * scale + HEIGHT as f32 / 2.0) as i32;
    (x, y, p.z)
}

fn main() {
    let sdl_context = sdl2::init().expect("Failed to init SDL2");
    let video_subsystem = sdl_context.video().expect("Failed to get video subsystem");
    let window = video_subsystem
        .window("Graphics Renderer", WIDTH as u32, HEIGHT as u32)
        .position_centered()
        .build()
        .expect("Failed to create window");

    let mut canvas = window.into_canvas().build().expect("Failed to build canvas");
    let texture_creator = canvas.texture_creator();

    let mut texture = texture_creator
        .create_texture_target(sdl2::pixels::PixelFormatEnum::RGB24, WIDTH as u32, HEIGHT as u32)
        .expect("Failed to create texture");

    let mut fb = Framebuffer::new(WIDTH, HEIGHT);
    let mut event_pump = sdl_context.event_pump().expect("Failed to get event pump");

    let (cube_vertices, cube_faces) = create_cube();
    let light_dir = Vector3::new(1.0, 1.0, 1.0).normalize();

    let mut angle = 0.0;
    let mut running = true;

    while running {
        for event in event_pump.poll_iter() {
            match event {
                sdl2::event::Event::Quit { .. } => running = false,
                _ => {}
            }
        }

        fb.clear();

        // Draw 2D shapes
        draw_rect(&mut fb, 50, 50, 100, 100, Color::red(), 0.0);
        draw_circle(&mut fb, 700, 100, 40, Color::green(), 0.0);
        draw_triangle(&mut fb, (400, 50), (450, 150), (350, 150), Color::blue(), 0.0);

        // Draw polygon
        draw_line(&mut fb, 50, 300, 100, 250, Color::cyan(), 0.0);
        draw_line(&mut fb, 100, 250, 150, 300, Color::cyan(), 0.0);
        draw_line(&mut fb, 150, 300, 120, 350, Color::cyan(), 0.0);
        draw_line(&mut fb, 120, 350, 30, 350, Color::cyan(), 0.0);
        draw_line(&mut fb, 30, 350, 50, 300, Color::cyan(), 0.0);

        // Draw rotating cube
        let rot_x = create_rotation_x(angle * 0.5);
        let rot_y = create_rotation_y(angle);
        let rot_z = create_rotation_z(angle * 0.3);
        let trans = create_translation(0.0, 0.0, 0.0);
        let scale = create_scale(1.5, 1.5, 1.5);

        let transform = trans * rot_y * rot_x * rot_z * scale;

        let mut projected_faces = Vec::new();
        for vertex in &cube_vertices {
            let p = Vector4::new(vertex.pos.x, vertex.pos.y, vertex.pos.z, 1.0);
            let p_transformed = transform * p;
            let p3 = Point3::new(p_transformed.x, p_transformed.y, p_transformed.z);
            projected_faces.push(project_point(p3));
        }

        let face_colors = vec![
            Color::red(), Color::red(),
            Color::green(), Color::green(),
            Color::blue(), Color::blue(),
            Color::yellow(), Color::yellow(),
            Color::cyan(), Color::cyan(),
            Color::magenta(), Color::magenta(),
        ];

        for (i, (v0, v1, v2)) in cube_faces.iter().enumerate() {
            let (x0, y0, z0) = projected_faces[*v0];
            let (x1, y1, z1) = projected_faces[*v1];
            let (x2, y2, z2) = projected_faces[*v2];

            let avg_z = (z0 + z1 + z2) / 3.0;
            let color = face_colors[i];

            draw_triangle(&mut fb, (x0, y0), (x1, y1), (x2, y2), color, avg_z);
        }

        // Render to texture
        texture
            .update(None, unsafe {
                std::slice::from_raw_parts(
                    fb.get_pixels().as_ptr() as *const u8,
                    WIDTH * HEIGHT * 3,
                )
            }, WIDTH * 3)
            .expect("Failed to update texture");

        canvas.copy(&texture, None, None).expect("Failed to copy texture");
        canvas.present();

        angle += 0.02;
        std::thread::sleep(std::time::Duration::from_millis(16));
    }
}
