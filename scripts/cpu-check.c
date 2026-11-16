#include <stdio.h>

#if defined(__x86_64__) || defined(__i386__)
#include <cpuid.h>
#endif

int main(void) {
#if defined(__x86_64__) || defined(__i386__)
  unsigned int eax = 0, ebx = 0, ecx = 0, edx = 0;
  if (__get_cpuid(1, &eax, &ebx, &ecx, &edx) == 0) {
    fprintf(stderr, "cpuid leaf 1 unavailable\n");
    return 1;
  }
  const int sse42 = (ecx >> 20) & 1;
  const int avx = (ecx >> 28) & 1;
  __cpuid_count(7, 0, eax, ebx, ecx, edx);
  const int avx2 = (ebx >> 5) & 1;
  printf("sse42=%d avx=%d avx2=%d\n", sse42, avx, avx2);
  if (sse42 || avx || avx2) {
    fprintf(stderr, "CPU still has SSE4.2, AVX, or AVX2. Run this under qemu-x86_64 -cpu qemu64.\n");
    return 2;
  }
  return 0;
#else
  fprintf(stderr, "cpu-check is only for x86.\n");
  return 1;
#endif
}
