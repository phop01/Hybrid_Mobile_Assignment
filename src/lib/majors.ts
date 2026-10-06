// สาขาปริญญาตรี คณะสหวิทยาการ มข. วิทยาเขตหนองคาย (is.kku.ac.th/admission/public/program)
// แหล่งเดียวทั้งแอปและ server: src/data/majors.json · 2 สาขาท้ายงดรับแล้ว แต่ยังมีนักศึกษาที่เรียนอยู่
import raw from '@/data/majors.json';

export const MAJORS: readonly string[] = raw;
