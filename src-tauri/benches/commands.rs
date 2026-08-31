use criterion::{black_box, criterion_group, criterion_main, Criterion};
use dailynotch_lib::greet;

fn benchmark_greet(c: &mut Criterion) {
    c.bench_function("greet_command", |b| {
        b.iter(|| greet(black_box("DailyNotch")))
    });
}

criterion_group!(benches, benchmark_greet);
criterion_main!(benches);
