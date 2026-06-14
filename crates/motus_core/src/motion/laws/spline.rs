use crate::motion::laws::MotionEvaluation;

#[derive(Debug, Clone)]
pub struct CubicSpline {
    x: Vec<f64>,
    y: Vec<f64>,
    b: Vec<f64>,
    c: Vec<f64>,
    d: Vec<f64>,
}

impl CubicSpline {
    pub fn new(mut points: Vec<(f64, f64)>) -> Self {
        if points.len() < 2 {
            // fallback
            return Self {
                x: vec![0.0, 1.0],
                y: vec![0.0, 1.0],
                b: vec![1.0],
                c: vec![0.0],
                d: vec![0.0],
            };
        }
        
        // ensure sorted by x
        points.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());
        
        let n = points.len();
        let mut x = vec![0.0; n];
        let mut y = vec![0.0; n];
        for i in 0..n {
            x[i] = points[i].0;
            y[i] = points[i].1;
        }
        
        let mut h = vec![0.0; n - 1];
        let mut alpha = vec![0.0; n - 1];
        for i in 0..n-1 {
            h[i] = x[i+1] - x[i];
            // To prevent div by zero
            if h[i] <= 0.0 { h[i] = 1e-9; }
            alpha[i] = (y[i+1] - y[i]) / h[i];
        }
        
        let mut c = vec![0.0; n];
        let mut l = vec![1.0; n];
        let mut mu = vec![0.0; n];
        let mut z = vec![0.0; n];
        
        for i in 1..n-1 {
            l[i] = 2.0 * (x[i+1] - x[i-1]) - h[i-1] * mu[i-1];
            mu[i] = h[i] / l[i];
            z[i] = (3.0 * (alpha[i] - alpha[i-1]) - h[i-1] * z[i-1]) / l[i];
        }
        
        l[n-1] = 1.0;
        z[n-1] = 0.0;
        c[n-1] = 0.0;
        
        let mut b = vec![0.0; n - 1];
        let mut d = vec![0.0; n - 1];
        
        for j in (0..n-1).rev() {
            c[j] = z[j] - mu[j] * c[j+1];
            b[j] = alpha[j] - h[j] * (c[j+1] + 2.0 * c[j]) / 3.0;
            d[j] = (c[j+1] - c[j]) / (3.0 * h[j]);
        }
        
        Self { x, y, b, c, d }
    }
    
    pub fn evaluate(&self, tau: f64) -> MotionEvaluation {
        let n = self.x.len();
        
        // Find interval
        let mut i = 0;
        if tau >= self.x[n-1] {
            i = n - 2;
        } else {
            while i < n - 2 && tau >= self.x[i+1] {
                i += 1;
            }
        }
        
        let dx = tau - self.x[i];
        let dx2 = dx * dx;
        let dx3 = dx2 * dx;
        
        let s = self.y[i] + self.b[i] * dx + self.c[i] * dx2 + self.d[i] * dx3;
        let v = self.b[i] + 2.0 * self.c[i] * dx + 3.0 * self.d[i] * dx2;
        let a = 2.0 * self.c[i] + 6.0 * self.d[i] * dx;
        let j = 6.0 * self.d[i];
        
        MotionEvaluation { s, v, a, j }
    }
}
